# Third-party assets

Every asset that is not written for this project, with its source and
licence. Prefer CC0.

## Characters (`public/models/`)

All five files are VRoid Studio sample models (VRM 0.x), downloaded on
2026-11-10 from the mirror <https://github.com/madjin/vrm-samples>, then
**modified** for the web by `tools/slim-vrm.py`: textures resized (max
1024 px, normal maps 512 px), re-encoded as WebP (`EXT_texture_webp`), and
the thumbnail shrunk to 128 px. Geometry, bones, expressions and the VRM
licence metadata are untouched. Result: 4–5 MB per character instead of
13–18 MB. Original SHA-256 prefixes are given so the source file can be
identified.

| File | Character | Source model (original size, SHA-256 prefix) | Licence | How it was checked |
|---|---|---|---|---|
| `jake.vrm` (4.0 MB) | Jake | pixiv — `HairSample_Male` (`vroid/beta/HairSample_Male.vrm`, 18.5 MB, `7aeca142dabbc26b`) | **CC0** | VRM meta inside the file: `licenseName: "CC0"`. pixiv's help article "Do VRoid Studio's sample models come with conditions of use?" (article 4402614652569, edited 2025-01-22, read through the Zendesk API `vroid.pixiv.help/api/v2/help_center/en-us/articles/4402614652569.json` because the page answers 403) lists HairSample_Male under "CC0 license models". |
| `lily.vrm` (4.2 MB) | Lily | pixiv — "β Ver AvatarSample_2", file `Vivi.vrm` (`vroid/beta/Vivi.vrm`, 18.1 MB, `eaf902e041a7a810`) | **CC0** | VRM meta: `licenseName: "CC0"`. Same pixiv article lists β Ver AvatarSample_2 as CC0; its own article (360014900273) says "The CC license for this model is CC0". |
| `emma.vrm` (4.6 MB) | Emma | pixiv — `AvatarSample_A` (`vroid/stable/AvatarSample_A.vrm`, 15.1 MB, `b86b0b8a66d48911`) | **pixiv sample-model conditions (not CC0)** | VRM meta: `licenseName: "Other"`, allowed for everyone, commercial use allowed. pixiv article "VRoidPreset_A - Z" (4402394424089, edited 2024-12-26, read through the Zendesk API) gives the conditions for AvatarSample_A/B/C: anyone may use the .vroid and VRM files, for profit or not, **no credit needed**; editing the model and **redistributing** it is explicitly allowed. Prohibited, among others: redistributing it with the conditions set to CC0, redistributing it **for a fee**, using it to build a character-creation service, discriminatory or criminal use. Our use (a free, public repository and site; licence metadata kept as "Other") fits these conditions. |
| `maya.vrm` (4.9 MB) | Maya | pixiv — `AvatarSample_B` (`vroid/stable/AvatarSample_B.vrm`, 15.4 MB, `4a271bd3b5a3d19e`) | **pixiv sample-model conditions (not CC0)** | Same as Emma. |
| `ollie.vrm` (4.5 MB) | Ollie | pixiv — `AvatarSample_C` (`vroid/stable/AvatarSample_C.vrm`, 13.1 MB, `395d5b04696e888f`) | **pixiv sample-model conditions (not CC0)** | Same as Emma. |

Credit (not required, given anyway): character models © pixiv Inc., VRoid
Studio sample models.

Models looked at and **not used**: the other CC0 VRoid β models (Sendagaya
Shibu and Shino, Sakurada Fumiriya, Darkness Shibu, Vita, Victoria Rubin,
HairSample_Female) — school uniforms or fantasy outfits that fit none of the
roles; `Seed-san` (VRM Public License 1.0, credit required — fine, but a
mascot, not a person); the CC0 100Avatars collection by Polygonal Mind
(<https://github.com/ToxSam/open-source-avatars>) — mostly fantasy or
object characters, low-detail faces without the expressions we need.

## Pictures (`public/pictures/`)

Scene and character thumbnails for the home screen. Rendered by this project
from its own scenes and the models above (screenshots of the running app,
2026-11-10); same licences as the models they show.

## Scenes and animations

No third-party file. The café, office and street are built in code from
simple shapes (`src/scene/sets.ts`); all gestures and the walk are written
by hand as bone rotations (`src/scene/gestures.ts`). No Mixamo or other
animation file is used.

## Software libraries (npm, not redistributed as files in this repo)

| Package | Licence |
|---|---|
| `three` | MIT |
| `@pixiv/three-vrm` | MIT |
| `@google/genai` | Apache-2.0 |
| `ts-fsrs` 6.0.0 (phase 4, spaced repetition) | MIT |
| `@open-spaced-repetition/srs-kit` 1.0.0 (dependency of `ts-fsrs`) | BSD-3-Clause |
| `pdfjs-dist` 6.5.438 (phase 5, PDF text in the browser; Mozilla PDF.js) | Apache-2.0 |

`pdfjs-dist`: version 6.5.438 is the latest on npm (published 2026-11-01,
checked 2026-11-10 with `npm view`); its `package.json` and `LICENSE` say
Apache-2.0. The built site serves its worker (`pdf.worker.min.mjs`, which
keeps Mozilla's licence header) and a lazily loaded chunk of the library; no
font, cmap or image from the package is shipped. Apache-2.0 allows use and
redistribution in a public, free project with the licence notice, which the
worker file carries.

Phase 4 content (missions, expressions to place) is written for this project.
Phase 5 texts (welcome, documents) are written for this project; imported
documents belong to the learner and stay in their browser (never committed).
