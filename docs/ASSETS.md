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

## Songs (`src/singing/songs.ts`, phase 7)

No audio file, no MIDI file, no score image: each song is a few lines of
text (the words, and the tune typed by hand as note names and lengths),
played in the browser by WebAudio. Only songs whose **words and tune** are
in the public domain everywhere (authors dead for more than 70 years, first
published before 1900), or songs written for this project. Checked on
2026-11-10.

| Song | Words | Tune | Status |
|---|---|---|---|
| Twinkle, Twinkle, Little Star (first verse) | Jane Taylor, "The Star", in *Rhymes for the Nursery*, 1806 (died 1824) | French air "Ah ! vous dirai-je, maman", first printed 1761, anonymous | Public domain. <https://en.wikipedia.org/wiki/Twinkle,_Twinkle,_Little_Star> |
| Are You Sleeping? (Brother John) | Traditional English version of "Frère Jacques" (French words printed 1811; English text in 19th-century song books), anonymous | "Frère Jacques", traditional, tune printed about 1780 | Public domain. <https://en.wikipedia.org/wiki/Fr%C3%A8re_Jacques> |
| Mary Had a Little Lamb (first verse) | Sarah Josepha Hale, 1830 (died 1879) | Traditional tune set by Lowell Mason, 1831 (died 1872) | Public domain. <https://en.wikipedia.org/wiki/Mary_Had_a_Little_Lamb> |
| Row, Row, Row Your Boat | Traditional American, printed 1852 | Tune credited to Eliphalet Oriel Lyte, *The Franklin Square Song Collection*, 1881 (died 1913) | Public domain. <https://en.wikipedia.org/wiki/Row,_Row,_Row_Your_Boat> |
| Amazing Grace (first verse) | John Newton, *Olney Hymns*, 1779 (died 1807) | "New Britain", anonymous, printed 1829, joined to the words by William Walker in 1835 (died 1875) | Public domain. <https://en.wikipedia.org/wiki/Amazing_Grace> |
| Three Thin Things | Written for English Buddy (phase 7) | Written for English Buddy | Ours (same terms as the repository) |
| Happy Harry | Written for English Buddy | Written for English Buddy | Ours |
| I Worked All Day | Written for English Buddy | Written for English Buddy | Ours |

The tunes were typed from memory of these very well-known melodies, not
copied from a modern arrangement or edition (an arrangement can carry its own
rights; the bare melody does not). The accompaniment is computed by the app
(a bass note and two chord notes per beat, chosen among the three main
chords of the key). The three original tunes are simple scale patterns
written for these words; any likeness to an existing tune is unintended.

Songs written for a learner ("Ta chanson") are produced in their browser —
by Gemini with their key, or assembled by the page — from their own review
cards, on one of the tunes above. They stay in their browser and are never
committed. The model is told never to quote or imitate existing lyrics.

Maya's hum, the count-in and the accompaniment are synthesised by the
page's own code (`src/singing/synth.ts`): no sample, no sound font.

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
Phase 6 (pronunciation) adds no third-party asset and no library: the 24
practice sentences, the sound tips and the spelling rules are written for this
project; "Écouter le modèle" uses the voices already installed in the
learner's browser (`speechSynthesis`), nothing is downloaded or shipped.
Phase 7 (singing) adds no library and no third-party file: see "Songs" above.
