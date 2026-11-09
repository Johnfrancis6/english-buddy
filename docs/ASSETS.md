# Third-party assets

Every asset that is not written for this project, with its source and
licence. Prefer CC0.

| File | What | Author / source | Licence | How it was checked |
|---|---|---|---|---|
| `public/models/HairSample_Male.vrm` | Placeholder character for Jake in phase 0 (VRM 0.x, 18 MB). To be replaced by Franco's own VRoid characters before phase 2. | pixiv — VRoid Studio sample model "HairSample_Male". Downloaded on 2026-11-09 from the mirror <https://github.com/madjin/vrm-samples> (`vroid/beta/HairSample_Male.vrm`). | **CC0** | The licence is written inside the file itself (VRM meta: `licenseName: "CC0"`, `allowedUserName: "Everyone"`, `commercialUssageName: "Allow"`), read with a script on 2026-11-09. The mirror's README lists it under "CC0 license models" and points to pixiv's help page <https://vroid.pixiv.help/hc/en-us/articles/4402614652569>; that page could not be opened from the build session (HTTP 403), so it was not read directly. |

## Software libraries (npm, not redistributed as files in this repo)

| Package | Licence |
|---|---|
| `three` | MIT |
| `@pixiv/three-vrm` | MIT |
| `@google/genai` | Apache-2.0 |
