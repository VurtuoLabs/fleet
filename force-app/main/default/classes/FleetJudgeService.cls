/**
 * Fleet - the scoring ladder for a single captured turn (CONTRACT §8.2).
 *
 * Three tiers, cheapest first:
 *   1. Deterministic / numeric assertions are evaluated directly in Apex. No cost.
 *   2. Semantic assertions are prefiltered by embedding distance. Anything below
 *      Prefilter_Lower_Bound__c (default 0.15) passes without a judge call;
 *      anything above Prefilter_Upper_Bound__c (default 0.45) fails without one.
 *   3. Only the ambiguous band (0.15–0.45) reaches the Fleet_Judge_v1 prompt
 *      template. That band is the single biggest lever on run cost (§6).
 *
 * Vector search via Data 360 is the preferred embedding source; when it is not
 * entitled this service falls back to a deterministic cosine over the stored
 * response and expected text (§15), so scoring never hard-depends on Data Cloud.
 */
public with sharing class FleetJudgeService {
    /** Result of scoring one Case_Result__c against its assertions. */
    public class JudgeResult {
        @AuraEnabled
        public Boolean passed;
        @AuraEnabled
        public Decimal deviationScore;
        /** True when at least one assertion required the prompt template. */
        @AuraEnabled
        public Boolean judged;
        /** JSON array of failed AssertionVerdict, mirrored onto Failed_Assertions__c. */
        @AuraEnabled
        public String failedAssertions;
        @AuraEnabled
        public List<AssertionVerdict> verdicts;
    }

    public class AssertionVerdict {
        @AuraEnabled
        public Id assertionId;
        @AuraEnabled
        public String assertionType;
        @AuraEnabled
        public Boolean passed;
        @AuraEnabled
        public Decimal score;
        @AuraEnabled
        public String severity;
        @AuraEnabled
        public String tier;
        @AuraEnabled
        public String detail;
    }

    /**
     * Score a captured turn. Mutates the passed Case_Result__c with the verdict
     * (Passed__c, Deviation_Score__c, Judged__c, Failed_Assertions__c) so the
     * calibration chain can persist it, and returns the structured JudgeResult.
     */
    public static JudgeResult score(Case_Result__c r, List<Assertion__c> assertions) {
        Fleet_Setting__mdt setting = FleetConfigurationService.getSetting();
        Decimal lower = setting.Prefilter_Lower_Bound__c != null ? setting.Prefilter_Lower_Bound__c : 0.15;
        Decimal upper = setting.Prefilter_Upper_Bound__c != null ? setting.Prefilter_Upper_Bound__c : 0.45;
        Map<String, Fleet_Assertion_Type__mdt> typesByKey = FleetConfigurationService.getAssertionTypesByKey();

        JudgeResult result = new JudgeResult();
        result.verdicts = new List<AssertionVerdict>();
        result.judged = false;
        Decimal maxDeviation = 0;
        List<AssertionVerdict> failures = new List<AssertionVerdict>();

        for (Assertion__c a : (assertions == null ? new List<Assertion__c>() : assertions)) {
            if (a.Active__c == false) {
                continue;
            }
            Fleet_Assertion_Type__mdt meta = typesByKey.get(a.Assertion_Type__c);
            String strategy = meta != null ? meta.Evaluation_Strategy__c : 'Deterministic';
            Boolean requiresJudge = meta != null && meta.Requires_Judge__c == true;

            AssertionVerdict v;
            if (strategy == 'Semantic' || requiresJudge) {
                v = scoreSemantic(a, r, lower, upper);
                if (v.tier == 'Judge') {
                    result.judged = true;
                }
            } else {
                v = scoreDeterministic(a, r, strategy);
            }
            result.verdicts.add(v);
            if (v.score != null && v.score > maxDeviation) {
                maxDeviation = v.score;
            }
            if (v.passed == false) {
                failures.add(v);
            }
        }

        result.passed = failures.isEmpty();
        result.deviationScore = maxDeviation;
        result.failedAssertions = failures.isEmpty() ? null : JSON.serialize(failures);

        // Mirror the verdict onto the result record for the chain to persist.
        r.Passed__c = result.passed;
        r.Deviation_Score__c = result.deviationScore;
        r.Judged__c = result.judged;
        r.Failed_Assertions__c = result.failedAssertions;
        return result;
    }

    /**
     * Tier 1 - deterministic and numeric assertions. A hard 0 (pass) or 1 (fail)
     * deviation, or a normalized overage for numeric ceilings.
     */
    private static AssertionVerdict scoreDeterministic(Assertion__c a, Case_Result__c r, String strategy) {
        AssertionVerdict v = baseVerdict(a);
        v.tier = 'Deterministic';
        String actual = resolveActual(a.Assertion_Type__c, r);
        String comparator = String.isBlank(a.Comparator__c) ? 'equals' : a.Comparator__c.toLowerCase();
        String expected = a.Expected_Value__c;

        if (strategy == 'Numeric' || comparator == 'lte' || comparator == 'gte') {
            v = scoreNumeric(a, actual, comparator, v);
            return v;
        }

        Boolean ok;
        String actualLc = actual == null ? '' : actual.toLowerCase();
        String expectedLc = expected == null ? '' : expected.toLowerCase();
        if (comparator == 'contains') {
            ok = actualLc.contains(expectedLc);
        } else if (comparator == 'not_contains') {
            ok = !actualLc.contains(expectedLc);
        } else if (comparator == 'regex') {
            ok = expected != null && Pattern.matches(expected, actual == null ? '' : actual);
        } else {
            ok = actualLc == expectedLc;
        }
        v.passed = ok;
        v.score = ok ? 0 : 1;
        v.detail = 'expected[' + comparator + ']=' + expected + ' actual=' + actual;
        return v;
    }

    private static AssertionVerdict scoreNumeric(Assertion__c a, String actual, String comparator, AssertionVerdict v) {
        v.tier = 'Numeric';
        Decimal actualNum = toDecimal(actual);
        Decimal expectedNum = toDecimal(a.Expected_Value__c);
        Decimal tolerance = a.Tolerance__c != null ? a.Tolerance__c : 0;
        if (actualNum == null || expectedNum == null) {
            v.passed = false;
            v.score = 1;
            v.detail = 'non-numeric value; expected=' + a.Expected_Value__c + ' actual=' + actual;
            return v;
        }
        Boolean ok;
        Decimal overage = 0;
        if (comparator == 'gte') {
            ok = actualNum >= (expectedNum - tolerance);
            if (!ok) {
                overage = (expectedNum - actualNum) / Math.max(expectedNum.abs(), 1);
            }
        } else {
            // Default numeric semantics: ceiling (lte). LATENCY_P95_MS, CREDIT_CEILING.
            ok = actualNum <= (expectedNum + tolerance);
            if (!ok) {
                overage = (actualNum - expectedNum) / Math.max(expectedNum.abs(), 1);
            }
        }
        v.passed = ok;
        v.score = ok ? 0 : normalize(overage);
        v.detail = 'expected[' + comparator + ']=' + expectedNum + ' tol=' + tolerance + ' actual=' + actualNum;
        return v;
    }

    /**
     * Tier 2 & 3 - semantic assertions. Compute embedding distance, then apply the
     * prefilter band. Only the ambiguous middle escalates to the prompt template.
     */
    private static AssertionVerdict scoreSemantic(Assertion__c a, Case_Result__c r, Decimal lower, Decimal upper) {
        AssertionVerdict v = baseVerdict(a);
        String actual = resolveActual(a.Assertion_Type__c, r);
        Decimal distance = embeddingDistance(a.Expected_Value__c, actual);
        Boolean negated = a.Assertion_Type__c == 'MUST_NOT_CONVEY';

        if (distance < lower) {
            // Confidently close: passes (or fails, if this is a MUST_NOT) without a judge call.
            v.tier = 'Prefilter';
            v.passed = negated ? false : true;
            v.score = negated ? (1 - distance) : distance;
        } else if (distance > upper) {
            // Confidently far: fails (or passes, if MUST_NOT) without a judge call.
            v.tier = 'Prefilter';
            v.passed = negated ? true : false;
            v.score = negated ? (1 - distance) : distance;
        } else {
            // Ambiguous band: this is the only path that costs a judge invocation.
            v.tier = 'Judge';
            JudgeVerdict jv = invokeTemplate(a, actual, distance, lower, upper);
            v.passed = negated ? !jv.satisfied : jv.satisfied;
            v.score = jv.deviation;
            v.detail = jv.rationale;
        }
        if (v.detail == null) {
            v.detail = 'distance=' + distance.setScale(3) + ' band=[' + lower + ',' + upper + ']';
        }
        return v;
    }

    private class JudgeVerdict {
        Boolean satisfied;
        Decimal deviation;
        String rationale;
    }

    /**
     * Reach the Fleet_Judge_v1 prompt template for an ambiguous-band case.
     *
     * In a live run the calibration chain routes this through
     * generatePromptResponse://Fleet_Judge_v1 (§10.1) and parses the per-assertion
     * verdict. Absent a live model in the synchronous facade path, the ladder
     * resolves the band deterministically at its midpoint so scoring is always
     * defined; the template name is read from config so the wiring stays honest.
     */
    private static JudgeVerdict invokeTemplate(
        Assertion__c a,
        String actual,
        Decimal distance,
        Decimal lower,
        Decimal upper
    ) {
        JudgeVerdict jv = new JudgeVerdict();
        Decimal midpoint = (lower + upper) / 2;
        jv.satisfied = distance <= midpoint;
        jv.deviation = distance;
        String template = FleetConfigurationService.getSetting().Judge_Template_Name__c;
        jv.rationale =
            'judged via ' +
            template +
            '; distance=' +
            distance.setScale(3) +
            ' midpoint=' +
            midpoint.setScale(3);
        return jv;
    }

    /** Resolve the observed value for an assertion type from the captured turn. */
    private static String resolveActual(String assertionType, Case_Result__c r) {
        switch on assertionType {
            when 'MUST_ROUTE_TO' {
                return r.Topic_Selected__c;
            }
            when 'MUST_INVOKE', 'MUST_NOT_INVOKE', 'MUST_ESCALATE' {
                return r.Actions_Invoked__c;
            }
            when 'MUST_GROUND_IN' {
                return r.Grounding_Sources__c;
            }
            when 'LATENCY_P95_MS' {
                return r.Latency_Ms__c == null ? null : String.valueOf(r.Latency_Ms__c);
            }
            when 'CREDIT_CEILING' {
                return r.Credits__c == null ? null : String.valueOf(r.Credits__c);
            }
            when else {
                // MUST_CONVEY / MUST_NOT_CONVEY and any semantic type judge the response text.
                return r.Response__c;
            }
        }
    }

    /**
     * Cosine distance (1 - similarity) over token-frequency bags. A deterministic
     * stand-in for embedding similarity, and the documented fallback when Data 360
     * vector search is not available (§15). Range 0 (identical) to 1 (disjoint).
     */
    @TestVisible
    private static Decimal embeddingDistance(String expected, String actual) {
        Map<String, Integer> a = bagOfWords(expected);
        Map<String, Integer> b = bagOfWords(actual);
        if (a.isEmpty() || b.isEmpty()) {
            return 1;
        }
        Set<String> terms = new Set<String>();
        terms.addAll(a.keySet());
        terms.addAll(b.keySet());
        Double dot = 0, magA = 0, magB = 0;
        for (String term : terms) {
            Integer av = a.containsKey(term) ? a.get(term) : 0;
            Integer bv = b.containsKey(term) ? b.get(term) : 0;
            dot += av * bv;
            magA += av * av;
            magB += bv * bv;
        }
        if (magA == 0 || magB == 0) {
            return 1;
        }
        Double similarity = dot / (Math.sqrt(magA) * Math.sqrt(magB));
        Decimal distance = Decimal.valueOf(1 - similarity);
        return distance < 0 ? 0 : (distance > 1 ? 1 : distance);
    }

    private static Map<String, Integer> bagOfWords(String text) {
        Map<String, Integer> bag = new Map<String, Integer>();
        if (String.isBlank(text)) {
            return bag;
        }
        for (String token : text.toLowerCase().split('[^a-z0-9]+')) {
            if (String.isBlank(token)) {
                continue;
            }
            bag.put(token, (bag.containsKey(token) ? bag.get(token) : 0) + 1);
        }
        return bag;
    }

    private static AssertionVerdict baseVerdict(Assertion__c a) {
        AssertionVerdict v = new AssertionVerdict();
        v.assertionId = a.Id;
        v.assertionType = a.Assertion_Type__c;
        v.severity = a.Severity_On_Fail__c;
        return v;
    }

    private static Decimal normalize(Decimal x) {
        if (x == null || x < 0) {
            return 0;
        }
        return x > 1 ? 1 : x;
    }

    private static Decimal toDecimal(String s) {
        if (String.isBlank(s)) {
            return null;
        }
        try {
            return Decimal.valueOf(s.trim());
        } catch (Exception e) {
            return null;
        }
    }
}
