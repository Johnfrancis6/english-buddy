# État du projet — English Buddy

Dernière mise à jour : 2026-11-10 (fin de la construction de la phase 3, mode autopilote).

## Où on en est

- Phase 0 validée par Franco le 2026-11-10 ; pull request n° 1 fusionnée.
- **Phase 1 construite** (conversation pédagogique), branche `phase-1`,
  **en attente du test de Franco** avec le guide
  [docs/tests/phase-1.md](tests/phase-1.md).
- Lien de test : <https://johnfrancis6.github.io/english-buddy/> (et le labo :
  <https://johnfrancis6.github.io/english-buddy/lab.html>).
- **Phase 2 construite** (personnages et scènes), branche `phase-2` (partie
  de `phase-1`), guide [docs/tests/phase-2.md](tests/phase-2.md). Le site
  de test montre la dernière branche poussée, donc la phase 2.
- **Phase 3 construite** (mémoire et progrès), branche `phase-3` (partie
  de `phase-2`), guide [docs/tests/phase-3.md](tests/phase-3.md). Le site de
  test montre désormais la phase 3.
- Prochaine étape (autopilote) : phase 4 (habitudes et défis), ouverte par
  la session orchestratrice. Franco teste les guides 1, 2 puis 3 à son
  retour.

## Mode autopilote (Franco absent)

Ordre des phases choisi par Franco le 2026-11-10 : 3 mémoire des
personnages et progression (en local, Supabase facultatif), 4 révisions et
défis, 5 accueil et documents PDF, 6 prononciation, 7 chant, 8 finition.

Depuis le 2026-11-10, les phases s'enchaînent sans attendre le feu vert de
Franco (règles dans `CLAUDE.md`). La session de la phase 1 sert de chef
d'orchestre : elle ouvre chaque session de phase et vérifie chaque jour que
la chaîne avance. Arrêt prévu : fin de la phase 8, **avant** l'invitation des
amis et avant la fusion dans `main`.

## À faire au retour de Franco

- [ ] Tester les guides `docs/tests/phase-1.md`, puis phase 2, 3… dans
      l'ordre, et donner les remarques.
- [ ] Phase 1 : labo transcription (choisit la source qui garde les fautes).
- [ ] Phase 2 : images par seconde sur la GTX 1070 (café, bureau, rue),
      accents britannique / américain, voix Kore, Aoede, Orus, Leda
      acceptées ou non, gestes (naturels ? au bon moment ?), choix des
      personnages (modèles VRoid gratuits, style manga).
- [ ] Phase 3 : justesse des notes du bilan (trop sévères ? trop
      gentilles ?), mémoire vraie et naturelle (rien d'inventé, rien de
      gênant), utilité de « Mes progrès ».
- [ ] Phase 3, **facultatif** — activer les comptes en ligne (Supabase,
      gratuit), environ 10 minutes :
  1. Va sur <https://supabase.com>, clique sur « Start your project » et
     connecte-toi avec ton compte GitHub.
  2. « New project » : nom `english-buddy`, choisis un mot de passe de base
     de données (garde-le pour toi, il ne sert pas au site), région
     « West EU (Paris) » ou la plus proche, plan **Free**, puis « Create new
     project ». Attends 1 à 2 minutes.
  3. Menu de gauche → « SQL Editor » → « New query ». Ouvre le fichier
     [`supabase/schema.sql`](../supabase/schema.sql) du dépôt, copie **tout**
     son contenu, colle-le, clique sur « Run ». Le message doit être
     « Success. No rows returned ».
  4. Menu de gauche → « Authentication » → « URL Configuration » :
     « Site URL » = `https://johnfrancis6.github.io/english-buddy/` ; dans
     « Redirect URLs », « Add URL » avec la même adresse, puis « Save ».
  5. En haut du projet, bouton « Connect » : copie l'**URL du projet**
     (`https://xxxx.supabase.co`) et la **clé publique** (« publishable key »
     `sb_publishable_…`, ou « anon key » si c'est la seule proposée). Ces
     deux valeurs sont publiques par conception : la sécurité vient des
     règles « Row Level Security » du fichier SQL. **Ne donne jamais** la
     clé « secret » ni « service_role ».
  6. Donne ces deux valeurs à Claude (il les met dans
     `src/sync/config.ts`), ou colle-les toi-même dans Réglages → « Projet
     Supabase (avancé) » → « Utiliser ce projet » pour essayer.
  7. Réglages → « Compte (facultatif) » : ton e-mail → « Recevoir un lien de
     connexion » → ouvre le lien reçu **sur le même ordinateur** → tu
     reviens connecté ; « Synchroniser maintenant ».
  8. Limite connue du plan gratuit : Supabase n'envoie que quelques e-mails
     de connexion par heure ; un projet sans activité pendant une semaine
     est mis en pause (un clic pour le relancer).
- [ ] Ouvrir la pull request finale vers `main` et la fusionner (ou la
      demander à Claude).

## Auto-critique de la phase 3

Ce qui marche (mesuré dans la session de construction, Google **simulé**,
aucun serveur Supabase) :

- Après un bilan, les faits proposés par l'analyseur s'ajoutent à la
  mémoire (ou remplacent un fait existant), le résumé de la conversation
  est gardé par personnage ; le prompt suivant de Jake contient les faits,
  son dernier échange, le niveau estimé et les fautes fréquentes (test
  Playwright qui lit la configuration envoyée à Google).
- L'écran de mémoire : voir, corriger, effacer, ajouter ; gardé après
  rechargement. Un fait corrigé par l'apprenant n'est jamais écrasé.
- « Mes progrès » à partir de conversations enregistrées : niveau estimé et
  sous-notes, fautes par type et par semaine, temps de parole, mots
  nouveaux, mots par phrase, liste des conversations qui rouvre les bilans.
- Le schéma JSON du bilan demande les sous-notes (0–100, bornes appliquées
  par Google selon sa doc), les faits et le résumé ; anciens bilans lus sans
  erreur.
- Supabase : appels de la bibliothèque, fusion et effacements testés avec un
  faux client ; le SQL active la sécurité par ligne sur chaque table
  (vérifié par un test qui lit le fichier).
- Lint, 91 tests de logique, 7 tests Playwright au vert.

Ce qui est **supposé, pas mesuré** :

- Que `gemini-3.8-flash` remplisse bien les nouveaux champs avec la clé
  gratuite, et que ses notes soient **justes et stables** d'une conversation
  à l'autre (une note sur 100 à partir d'un texte transcrit est fragile).
- Que l'analyseur ne retienne que des faits vrais, sans rien inventer, et
  respecte la consigne « rien de sensible ».
- Que le personnage reparle de la mémoire **naturellement** en voix réelle
  (une ou deux choses) sans réciter ni passer au français (les notes sont en
  français).
- Le temps de parole : il compte les moments où le micro entend une voix
  (seuil de volume) ; bruit ou souffle peuvent l'augmenter.
- Supabase réel : jamais appelé (pas de projet). Le lien de connexion, le
  retour sur GitHub Pages et les règles RLS ne sont vérifiés que sur le
  papier et avec un faux client.

Ce qui est faible :

- Les sous-notes viennent d'une IA qui lit un texte : pas un examen. Elles
  sont toujours affichées comme « estimation » et moyennées sur 5 bilans.
- Mémoire partagée entre personnages : Emma peut connaître ta famille alors
  que tu en as parlé à Jake. Choix assumé (une seule vie), à revoir si
  Franco trouve ça bizarre.
- « Mots nouveaux » : première fois qu'un mot sort de ta bouche dans
  l'historique, hors mots très courants ; la première semaine compte
  presque tout ; une faute de transcription compte comme mot nouveau.
- Synchronisation simple : la fiche la plus récente gagne ; deux
  ordinateurs modifiant le même fait en même temps peuvent en perdre une
  version. Les conversations venues du compte n'ont pas leur texte (choix du
  brief).
- Tableau sans bibliothèque de graphiques : sobre ; pas de courbe de niveau
  dans le temps (les données sont prêtes, `levelHistory`).

## Auto-critique de la phase 2

Ce qui marche (mesuré dans la session de construction, Google **simulé**,
Chromium sans carte graphique) :

- Accueil avec choix du lieu et du personnage, aperçu 3D en direct, choix
  gardé ; cinq personnages qui se chargent (4 à 5 Mo chacun au lieu de 13 à
  18 Mo, sans différence visible) ; trois décors toon.
- Entrée en marchant, gestes (salut, hochement, rire, réflexion, check du
  poing) visibles sur captures ; déclenchés par la conversation : salut au
  premier mot du personnage, rire sur « haha », hochements quand
  l'apprenant parle (tests de logique et test Playwright avec Emma).
- Le prompt, la voix et le bilan suivent le personnage (Emma : accent
  britannique demandé, voix Kore, « Emma l'a reformulé »). Les conversations
  de la phase 1 se relisent.
- Coût de dessin mesuré : 130–300 appels, 40–55 k triangles par image.
- Lint, 68 tests de logique, 5 tests Playwright au vert.

Ce qui est **supposé, pas mesuré** :

- La fluidité sur la GTX 1070 : ici 2 à 8 images/s en rendu logiciel (CPU),
  sans valeur pour une vraie carte. Vu le coût de dessin (faible), j'attends
  55–60 images/s, mais c'est Franco qui mesure (ligne « Images/s »).
- Que `gemini-3.8-live` accepte les voix Kore, Aoede, Orus et Leda (dans la
  liste officielle, mais seule Puck a été essayée avec une vraie clé) et
  prenne vraiment l'accent britannique demandé dans le prompt.
- Le bon moment des gestes avec une vraie voix : la transcription du
  personnage arrive à peu près avec le son, mais le décalage réel n'est pas
  mesuré ; le rire n'apparaît que si le modèle écrit « haha ».

Ce qui est faible :

- Les gestes sont écrits à la main : sobres mais un peu mécaniques ; la
  marche est simple (pas de pieds plantés au sol). Amélioration possible :
  des clips CC0 adaptés au squelette VRM.
- Les personnages sont des modèles d'exemple VRoid (style manga, tous
  jeunes d'apparence) : Emma « 35 ans » et Lily « 9 ans » ne font pas
  vraiment leur âge. Trois modèles sur cinq ne sont pas CC0 (conditions
  pixiv : redistribution gratuite autorisée).
- Décors en formes simples : lisibles et légers, mais pauvres en détails.
- Le faux micro du navigateur de test déclenche « réfléchir » : la logique
  de « réflexion » dépend du détecteur de voix du micro, qui peut se
  tromper avec du bruit.

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

- Autopilote : phase 4 (habitudes et défis : révisions FSRS de ses propres
  fautes, défi du jour de 5 minutes, missions, expressions à placer, série
  de jours, carte des scènes), modèle conseillé **Opus 5.5**, branche
  `phase-4` créée depuis `phase-3`, ouverte par la session orchestratrice.
  Données prêtes pour elle : fautes et mots par conversation (IndexedDB),
  temps de parole mesuré par conversation (pour la série ≥ 3 min).

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
| 2026-11-10 | Phase 3 | Mémoire des personnages (faits en français, résumé par personnage, écran voir / corriger / effacer / ajouter) ; profil dans le prompt (niveau estimé, fautes fréquentes) ; bilan avec sous-notes, faits et résumé ; « Mes progrès » (niveau estimé, fautes par type et par semaine, temps de parole, mots nouveaux, longueur des phrases, toutes les conversations) ; compte Supabase préparé mais éteint (code, SQL avec RLS). Testé avec Google simulé, sans serveur Supabase | En attente (autopilote) |
| 2026-11-10 | Phase 2 | DESIGN.md + styles partagés ; accueil (lieu + personnage) ; 5 personnages VRoid gratuits allégés (Jake, Emma, Maya, Ollie en veste, Lily 9 ans) ; décors toon café / bureau / rue ; marche, salut, hochement, rire, réflexion, check du poing déclenchés par la conversation ; voix et prompt par personnage ; mesures repliables avec images/s. Testé avec Google simulé, sans GPU | En attente (autopilote) |

## Points ouverts

- Nom définitif de la plateforme (provisoire : « English Buddy »).
- Quatrième personnage (conférence / école) : hors version 1.
- Fiches personnages `docs/characters.md` : plus nécessaires (Franco ne crée
  plus les personnages) ; les personas sont dans `src/teaching/persona.ts`.
- Gestes plus naturels : clips d'animation CC0 (par exemple Quaternius)
  adaptés au squelette VRM, si Franco trouve les gestes faits main trop
  raides. Chanter et danser (Maya) : phase 6.
- Voix britanniques de la « Extended Voice Library » de Google
  (`GET /v1beta/voices`) : à essayer avec une clé, si l'accent demandé dans
  le prompt ne suffit pas.
- Personnages plus âgés ou plus réalistes (Emma 35 ans) : chercher d'autres
  modèles VRM libres si Franco le demande.
- Mobile hors périmètre : l'accueil s'affiche sur un écran étroit, mais rien
  n'est testé sur téléphone.
- Noms des voix Gemini (« Puck »…) non vérifiés dans la doc officielle.
- Garde-fou d'écho : seule l'annulation d'écho du navigateur est activée ;
  à revoir si quelqu'un utilise des haut-parleurs.
- Le site Pages affiche la dernière branche poussée (`main` ou `phase-*`) :
  à revoir quand `main` servira de version stable (phase 8).
- Poids des modèles 3D : réglé en phase 2 (4–5 Mo chacun, textures WebP).
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
- Liste de toutes les conversations passées : faite en phase 3 (dans « Mes
  progrès »).
- Profil de l'apprenant dans le prompt : fait en phase 3.
- Courbe du niveau estimé dans le temps (données prêtes) : si Franco la
  veut.
- Mémoire par personnage plutôt que partagée : si Franco trouve étrange
  qu'Emma sache ce qu'il a dit à Jake.
- Score de prononciation dans le niveau estimé : phase 6.
- Clés Supabase : la clé « anon » sera retirée par Supabase fin 2026 ; le
  code accepte la nouvelle clé « publishable ».
