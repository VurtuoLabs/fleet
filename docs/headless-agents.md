# Fleet - Headless (Agent Runtime API) agents

Fleet's Agentforce agents are **headless**: the Fleet UI Bundle (a Multi-Framework React app
on Headless 360) invokes them programmatically through the **Agent Runtime API**, not through
a messaging/chat channel or the standard Agentforce panel.

## What makes an agent headless here

The enabler is the **`CustomerWebClient` plannerSurface** on the agent's `GenAiPlannerBundle`.
That surface is what exposes the agent to the Agent Runtime API / custom web-client access.
(`EinsteinAgentApiChannel` is the "pure" API surface but is not available on all orgs, so
`CustomerWebClient` is the portable choice.)

```xml
<plannerSurfaces>
    <adaptiveResponseAllowed>false</adaptiveResponseAllowed>
    <callRecordingAllowed>false</callRecordingAllowed>
    <surface>SurfaceAction__CustomerWebClient</surface>
    <surfaceType>CustomerWebClient</surfaceType>
</plannerSurfaces>
```

## Per-agent status

| Agent | Form | Headless surface |
|---|---|---|
| `Fleet_Engine` | `genAiPlannerBundles/` (Agent Script) | ✅ `CustomerWebClient` declared in `Fleet_Engine.genAiPlannerBundle-meta.xml` |
| `Fleet_Curator` | `aiAuthoringBundles/` (Studio-visible) | ⚠️ applied post-publish - see below |

## Authoring-bundle caveat (Fleet_Curator)

An `AiAuthoringBundle` compiles its own `GenAiPlannerBundle` on publish. There is **no
`connection customerwebclient:` DSL** in Agent Script, so the `CustomerWebClient` surface
must be re-applied to the compiled planner after **every** publish:

```bash
sf agent publish authoring-bundle --api-name Fleet_Curator -o fleet
# then retrieve the generated GenAiPlannerBundle and add the CustomerWebClient
# plannerSurfaces block shown above, and deploy that planner back.
```

The `Fleet_Engine` planner bundle carries the surface in source and needs no patch.

## Invocation from the UI Bundle

The React app calls the agent through the platform SDK's Agent Runtime API (session start →
send message → receive planner response). No external services; the agent runs inside the org
and drives calibration, drift assessment, change attribution, and remediation (see CONTRACT.md §10).
