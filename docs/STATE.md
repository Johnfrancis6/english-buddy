# État du projet — English Buddy

Dernière mise à jour : 2026-11-10 (fin de la construction de la phase 1).

## Où on en est

- Phase 0 validée par Franco le 2026-11-10 ; pull request n° 1 fusionnée.
- **Phase 1 construite** (conversation pédagogique), branche `phase-1`,
  **en attente du test de Franco** avec le guide
  [docs/tests/phase-1.md](tests/phase-1.md).
- Lien de test : <https://johnfrancis6.github.io/english-buddy/> (et le labo :
  <https://johnfrancis6.github.io/english-buddy/lab.html>).
- Prochaine étape : retour de Franco (labo transcription, conversation,
  bilan), puis go / no-go pour la phase 2.

## Mode autopilote (Franco absent)

Depuis le 2026-11-10, les phases s'enchaînent sans attendre le feu vert de
Franco (règles dans `CLAUDE.md`). La session de la phase 1 sert de chef
d'orchestre : elle ouvre chaque session de phase et vérifie chaque jour que
la chaîne avance. Arrêt prévu : fin de la phase 8, **avant** l'invitation des
amis et avant la fusion dans `main`.

## À faire au retour de Franco

- [ ] Tester les guides `docs/tests/phase-1.md`, puis phase 2, 3… dans
      l'ordre, et donner les remarques.
- [ ] Phase 1 : labo transcription (choisit la source qui garde les fautes).
- [ ] Ouvrir la pull request finale vers `main` et la fusionner (ou la
      demander à Claude).

## Auto-critique de la phase 1

Ce qui marche (mesuré dans la session de construction, avec Google et Groq
**simulés**) :

- Le prompt complet de Jake part dans la configuration Live ; le texte
  s'affiche tour par tour ; les fautes et le « Pourquoi ? » s'affichent ;
  la conversation et le bilan reviennent après rechargement (IndexedDB) ;
  avec Groq, son texte remplace celui de Gemini et c'est lui qui va au bilan.
- Le labo écrit la même prise de son avec 4 sources et classe chaque faute
  (gardée / corrigée en silence / mal entendue).
- Mesuré contre les vrais serveurs, sans clé : CORS autorisé par Groq et
  Google ; `responseJsonSchema` reconnu par l'API `v1beta` ; erreur de fausse
  clé Groq = 401 `invalid_api_key`.
- 48 tests de logique, 4 tests Playwright, lint : au vert.

Ce qui est **supposé, pas mesuré** (aucune clé dans la session) :

- Quelle source garde le mieux les fautes : **aucune recommandation mesurée**.
  Par défaut on reste sur Gemini Live (pas de clé en plus). Mon pari, à
  vérifier par le labo : Groq Whisper garde plus de fautes que Gemini Live,
  et Gemini Flash « mot à mot » en corrige le plus (un modèle de langage a
  tendance à réparer les phrases), malgré la consigne.
- Que Jake reformule vraiment sans faire de leçon (dépend du modèle vocal).
- Que `gemini-3.8-flash` accepte le schéma JSON avec la clé gratuite, la
  justesse du bilan, son délai (estimé 10 à 30 s).
- Que la coupure des tours (au premier son de Jake) colle bien aux phrases
  dans une vraie conversation ; une transcription Live très en retard peut
  tomber dans le tour suivant.

Ce qui est faible :

- Le bilan lit un texte issu d'une reconnaissance vocale : il peut prendre
  une erreur de la machine pour une faute (consigne donnée au modèle, mais
  rien ne le garantit), ou manquer une faute « réparée » par la machine.
- Les 12 phrases du labo sont lues, pas spontanées : une machine peut se
  comporter autrement sur de la parole hésitante.
- Le niveau est fixé à B1 dans le prompt (profil réel en phase 3).
- Dans le labo, Google répond « Okay » à chaque phrase (petit bruit inutile).
- « Mon dernier bilan » ne rouvre que la dernière conversation (pas de liste).

## Auto-critique de la phase 0 (pour mémoire)

Ce qui marche (mesuré dans la session de construction, Chromium sans carte
graphique) :

- Le personnage se charge, regarde la caméra, cligne des yeux, respire ;
  angles de tête mesurés à ±3°.
- Les lèvres s'ouvrent sur un son et se referment dans le silence (test
  automatique).
- La clé est gardée dans `localStorage` et relue après rechargement.
- Une fausse clé donne le bon message en français (réponse réelle de
  Google : « API key not valid », code 1007).
- 21 tests de logique + 1 test de fumée Playwright au vert ; lint au vert.

Ce qui est **supposé, pas mesuré** (aucune clé dans la session : aucune vraie
conversation n'a été faite) :

- Que `gemini-3.8-live` accepte la clé gratuite de Franco et notre
  configuration (voix « Puck », transcription, reprise de session).
- Le délai réel (objectif < 1,5 s), la qualité de la voix, l'interruption.
- La tenue sur 10 minutes et la reconnexion automatique vers 10 minutes.
- Les messages « quota dépassé » et « modèle indisponible » (textes de
  Google devinés).
- La fluidité sur la GTX 1070 (aucun doute sérieux, mais non mesurée).
- Le déploiement GitHub Pages (dépend des réglages que seul Franco peut
  faire).

Ce qui est faible :

- Lèvres : basées sur le volume et trois bandes de fréquences, pas sur les
  vrais sons. Bouche ouverte/fermée au bon moment, formes approximatives.
- Le délai affiché dépend d'un seuil de volume du micro : dans une pièce
  bruyante ou avec un micro très faible, des tours peuvent ne pas être
  comptés.
- Le modèle 3D pèse 18 Mo (premier chargement lent sur une connexion
  lente) et n'est qu'un modèle d'essai.
- Pas de pipeline de secours (Groq Whisper + texte + voix) : prévu
  seulement si le test de 10 minutes échoue.

## Prochaine session

- Après le go de Franco sur la phase 1 : phase 2 (personnages et scènes),
  modèle conseillé **Opus 5.5**, branche `phase-2`, ouverte par cette session
  (règle de CLAUDE.md).

## Journal

| Date | Phase | Ce qui a été fait | Note de Franco |
|---|---|---|---|
| 2026-11-09 | Cadrage | Brief, décisions, état | — |
| 2026-11-09 | Phase 0 | Squelette Vite/TS, personnage VRM (regard, clignement, repos), voix Gemini Live avec clé du navigateur, lèvres synchronisées, mesure du délai, messages d'erreur, déploiement Pages, guide de test. Conversation réelle non testée (pas de clé en session) | Déploiement vert, « l'essai marche » (2026-11-10). Mesures détaillées à rapporter |
| 2026-11-10 | Phase 0 (retouche) | Réglage « Ton rythme de parole » : silence de fin de tour au choix (0,5 / 0,9 / 1,5 s) | En attente |
| 2026-11-10 | Phase 0 (mesure) | Rapport de Franco (Firefox 159, gemini-3.8-live, clé gratuite) : délai médian **0,96 s** sur 10 tours, 1 min 55 sans erreur. Deux faux délais (0,02 et 0,04 s) : la mesure ignore désormais les valeurs < 0,2 s | Reste à tester : 10 minutes, interruption, rythme de parole |
| 2026-11-10 | Phase 0 (mesure) | 2ᵉ rapport de Franco : **11 min 43 sans coupure ni refus** ; délai médian réel ≈ 1,3–1,4 s (37 tours, une fois retirés 17 faux délais < 0,2 s) ; aucune reconnexion observée. Ajout d'un indice de langue anglais pour la transcription | Transcription : mots mal écrits alors que Jake comprend |
| 2026-11-10 | Phase 0 (mesure) | 3ᵉ rapport : indice de langue accepté par Google ; médiane 1,05 s sur 3 min 29. Réglage de pause changé en cours de conversation, donc pause réellement utilisée incertaine. Le rapport indique désormais les réglages de la conversation et compte les prises de parole de Jake par-dessus l'apprenant | En attente d'un essai « Posé » propre |
| 2026-11-10 | Phase 0 (mesure) | 4ᵉ rapport, réglage « Posé » (900 ms) actif dès le départ : médiane **1,42 s** sur 7 tours (1 min 14), soit environ +0,4 s par rapport à « Rapide », comme prévu | Ressenti (coupures, transcription) à confirmer |
| 2026-11-10 | Phase 0 (validation) | Les deux rythmes gardés, « Rapide » par défaut | « Oui il me laisse finir, feu vert pour la phase 1 » ; « je veux les deux délais, je passerai sur 500 pour une meilleure fluidité » |
| 2026-11-10 | Phase 1 | Prompt complet de Jake (reprise sans leçon, tours courts, questions ouvertes), texte en direct, labo transcription (Gemini Live / Groq Whisper / Gemini Flash), bilan JSON en français par type de faute, bouton « Pourquoi ? », conversations en texte dans le navigateur. Testé avec Google et Groq simulés, aucune vraie conversation | En attente |

## Points ouverts

- Nom définitif de la plateforme (provisoire : « English Buddy »).
- Quatrième personnage (conférence / école) : hors version 1.
- Fiches personnages `docs/characters.md` (Jake, Emma, Maya) pour VRoid
  Studio : à écrire au plus tard au début de la phase 2 (le brief les
  attend « à partir de la phase 0 »).
- Noms des voix Gemini (« Puck »…) non vérifiés dans la doc officielle.
- Garde-fou d'écho : seule l'annulation d'écho du navigateur est activée ;
  à revoir si quelqu'un utilise des haut-parleurs.
- Le site Pages affiche la dernière branche poussée (`main` ou `phase-*`) :
  à revoir quand `main` servira de version stable (phase 8).
- Poids du modèle 3D (18 Mo) : à réduire quand Franco exportera ses propres
  personnages.
- Détection « intelligente » des phrases inachevées (distinguer une
  hésitation d'une fin de phrase) : l'API Gemini ne propose qu'une durée de
  silence. Une vraie détection demanderait notre propre détecteur dans le
  navigateur ; à décider après le retour de Franco sur le réglage de rythme.
- Qualité de la transcription des phrases de l'apprenant (risque n° 3) :
  labo construit en phase 1, **résultat à mesurer par Franco** ; choisir la
  source par défaut d'après ses chiffres.
- Reconnexion automatique vers 10 minutes : jamais déclenchée en test réel
  (Google n'a pas coupé à 11 min 43).
- Jake prend souvent la parole pendant que l'apprenant parle encore
  (17 fois en 11 minutes en réglage « Rapide ») : à revoir avec le réglage
  de rythme ; sinon détecteur de fin de tour maison.
- Non confirmés par Franco à la fin de la phase 0 (à revérifier en
  phase 1) : interruption de Jake, effet de l'indice de langue sur la
  transcription, crédibilité des lèvres, test dans Chrome (tous les essais
  ont été faits dans Firefox 159).
- Bilan : scores par compétence, mission, expressions placées et faits à
  mémoriser prévus par le brief, laissés aux phases 3–4.
- Google pousse désormais l'API « Interactions » (`response_format`) pour la
  sortie structurée ; on utilise `generateContent` + `responseJsonSchema`
  (toujours accepté). À revoir si Google le retire.
- Limites exactes du plan gratuit Groq : visibles seulement dans le compte
  (la doc publique donne celles du plan Developer : 20 requêtes/min).
- Liste de toutes les conversations passées (aujourd'hui : seulement la
  dernière via « Mon dernier bilan ») : plutôt avec le tableau de bord
  (phase 3).
- Profil de l'apprenant (niveau, fautes récentes) injecté dans le prompt de
  Jake : fixé à B1 pour l'instant, vrai profil en phase 3.
