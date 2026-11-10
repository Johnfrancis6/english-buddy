# État du projet — English Buddy

Dernière mise à jour : 2026-11-10 (fin de la phase 8, **fin de la chaîne
autopilote**).

## Où on en est

- Phase 0 validée par Franco le 2026-11-10 ; pull request n° 1 fusionnée.
- Phases 1 à 8 **construites en autopilote**, chacune sur sa branche partie
  de la précédente (`phase-1` → … → `phase-8`). **Rien n'est fusionné dans
  `main`.** Aucune n'a été testée par Franco.
- Lien de test : <https://johnfrancis6.github.io/english-buddy/> (il montre la
  dernière branche poussée : `phase-8`). Labo :
  <https://johnfrancis6.github.io/english-buddy/lab.html>.
- **Pour tester au retour : un seul guide,
  [docs/tests/GUIDE-COMPLET.md](tests/GUIDE-COMPLET.md)** (environ 2 heures
  en 5 séances), qui renvoie aux guides de chaque phase
  ([1](tests/phase-1.md), [2](tests/phase-2.md), [3](tests/phase-3.md),
  [4](tests/phase-4.md), [5](tests/phase-5.md), [6](tests/phase-6.md),
  [7](tests/phase-7.md), [8](tests/phase-8.md)).
- La chaîne s'arrête ici, **avant** l'invitation des amis et **avant** la
  fusion dans `main` : ce sont les décisions de Franco.

## Mode autopilote (Franco absent)

Ordre des phases choisi par Franco le 2026-11-10 : 3 mémoire des
personnages et progression (en local, Supabase facultatif), 4 révisions et
défis, 5 accueil et documents PDF, 6 prononciation, 7 chant, 8 finition.
Les phases se sont enchaînées sans attendre son feu vert (règles dans
`CLAUDE.md`), ouvertes par la session orchestratrice. **Quand Franco revient,
les règles normales reprennent** : une phase à la fois, son feu vert entre
deux.

## Bilan de la chaîne autopilote (phases 1 à 8)

Ce qui existe : conversation vocale en direct avec 5 personnages 3D dans 3
lieux, reprise des fautes sans leçon, bilan en français, mémoire, « Mes
progrès », révisions FSRS, défi du jour, 9 missions, accueil guidé avec
création des clés gratuites, documents PDF, prononciation notée mot par mot,
karaoké avec Maya, et un seul endroit pour tout effacer. Tout reste dans le
navigateur ; aucune voix n'est gardée.

**Ce qui a été mesuré** pendant la construction : uniquement avec Google et
Groq **simulés**, sans carte graphique, sans haut-parleur, avec le micro
factice de Chromium (des bips) ; plus quelques appels réels avec de **fausses
clés** (CORS et messages d'erreur de Google, Groq et Azure). 206 tests de
logique et 21 tests Playwright vérifient le comportement de la page.

**Ce qui n'a jamais été mesuré** (aucune vraie clé, aucune vraie voix) — le
vrai test commence au retour de Franco :

| Phase | Mesuré (simulé ou fausses clés) | Jamais mesuré |
|---|---|---|
| 0 | Clé gardée, messages d'erreur ; **avec Franco** : 11 min 43 sans coupure, délai médian 1,0–1,4 s | Reconnexion vers 10 min, interruption, lèvres jugées par un humain |
| 1 | Prompt de Jake envoyé, texte en direct, bilan JSON, labo à 4 sources | Quelle source garde les fautes (labo), justesse du bilan, Jake qui reformule sans leçon |
| 2 | 5 personnages chargés (4–5 Mo), gestes déclenchés, coût de dessin 130–300 appels | Images/s sur la GTX 1070, voix Kore/Aoede/Orus/Leda, accent britannique, bon moment des gestes |
| 3 | Mémoire dans le prompt, écran mémoire, « Mes progrès », Supabase avec un faux client | Justesse et stabilité des notes, mémoire naturelle et vraie, Supabase réel |
| 4 | Cartes FSRS, défi et missions (prompts et mise à jour des cartes) | Perches sans donner la réponse, jugement des missions, 3 min de voix en 5 min de défi |
| 5 | Accueil en 6 étapes, vérification des clés (fausses clés), PDF lu, mots difficiles | Clics réels d'AI Studio et Groq, seuil du test du micro, qualité de vrais PDF |
| 6 | Exercice complet, cartes « son », contrôle Whisper | **Justesse de Gemini comme juge de prononciation** (risque principal), réponse Azure réelle |
| 7 | Karaoké, rythme sur des prises synthétiques, chanson écrite | **Tout ce qui s'entend**, rythme sur une vraie voix chantée |
| 8 | Effacement complet (Playwright lit le stockage), barre à 2 lignes à 420 px, premier chargement 285 Ko compressés au lieu de 365 | Messages d'erreur réels de Google en panne (texte « overloaded » supposé) |

## À faire au retour de Franco (dans cet ordre)

1. [ ] **Tester** avec [docs/tests/GUIDE-COMPLET.md](tests/GUIDE-COMPLET.md)
       (5 séances, environ 2 heures, dont une le lendemain) et renvoyer le
       message-type à la fin du guide, avec les rapports « Mesures de test ».
       Points clés : délai et coupures (phase 0), tableau du labo (phase 1),
       images/s sur la GTX 1070 (phase 2), justesse des bilans et de la
       mémoire (phases 1 et 3), perches du défi (phase 4), clics des clés
       (phase 5), notes de prononciation « sink / think » (phase 6), écouter
       Maya (phase 7), « Mes données » (phase 8).
2. [ ] **Clé Groq** gratuite (si pas déjà faite pendant l'accueil) : utile au
       labo, au contrôle de prononciation et au rythme des chansons. Étapes
       dans l'accueil guidé (étape 3).
3. [ ] Choisir la **source de transcription par défaut** d'après le labo
       (Claude la règle ensuite).
4. [ ] **Facultatif mais conseillé — clé Azure Speech** (mesure son par son,
       gratuite jusqu'à 5 h par mois) : créer un compte Microsoft Azure
       (carte bancaire probablement demandée pour l'identité), une ressource
       « Speech » en niveau **Free F0** (région France Central ou West
       Europe), copier « KEY 1 » et la région dans Réglages →
       « Prononciation ». Détails : guide de la phase 6, partie 4.
5. [ ] **Facultatif — comptes en ligne (Supabase, gratuit)**, environ
       10 minutes, à faire **avant d'inviter les amis** s'ils doivent
       retrouver leurs données sur un autre ordinateur :
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
6. [ ] **Facultatif** — dire si tu veux une vraie voix chantée payante
       (Lyria 3.5, environ 0,08 $ la chanson, facturation à activer).
7. [ ] Décisions à prendre après le test (voir « Points ouverts ») :
       prononciation dans le niveau estimé ou non, mémoire partagée ou par
       personnage, révisions écoutées par la machine, nom définitif.
8. [ ] **Fusionner dans `main`** : demander à Claude d'ouvrir la pull request
       de `phase-8` vers `main` (elle contient les phases 1 à 8), la relire,
       la fusionner. Ensuite le site de test montrera `main` tant qu'aucune
       autre branche n'est poussée (à régler : ne déployer que `main`).
9. [ ] **Inviter les amis** (5 à 20) : leur envoyer le lien ; l'accueil guidé
       leur fait créer leur propre clé gratuite. Rien à faire de plus sans
       Supabase (chacun garde ses données dans son navigateur).

## Auto-critique de la phase 8

Ce qui marche (mesuré dans la session de construction, Chromium sans GPU,
Google simulé) :

- Réglages → « Mes données » : les 7 magasins du navigateur et les clés, en
  un seul endroit, avec le nombre d'éléments ; « Effacer » par ligne ;
  « Conversations, bilans et chansons » efface aussi les chansons et les
  notes de chant ; « Tout effacer » vide tout (clés comprises), déconnecte le
  compte et recharge la page (Playwright qui lit IndexedDB et
  `localStorage`). Un test de logique échoue si un futur magasin ou une
  future entrée de `localStorage` n'est pas effaçable.
- Les cartes effacées ne reviennent plus au rechargement (la conversion des
  anciens bilans ne se fait qu'une fois).
- Barre du haut : 79 px (2 lignes) à 360, 420 et 560 px, au lieu de 142 px
  (3 lignes) qui cachaient le haut de l'accueil ; les panneaux se placent
  sous sa hauteur réelle. Labo et carte des missions sans défilement de côté
  à 420 px (Playwright).
- Premier chargement : 285 Ko compressés au lieu de 365 Ko (la bibliothèque
  de Google n'arrive qu'au premier « Démarrer ») — mesuré sur `vite build`.
- Erreurs : chaque message de Google, Groq ou Azure dit quoi faire (test qui
  passe sur tous les cas) ; panne serveur = « surchargé, réessaie dans une
  minute » ; morceau de page non chargé = « recharge la page ».
- Relecture du code et des tests : les clés ne sont envoyées qu'à leur
  service, jamais dans une adresse, jamais au compte en ligne ; rien d'audio
  n'est écrit dans IndexedDB ni envoyé au compte (tests qui lisent le code et
  le stockage).
- Tour complet de 19 écrans à 1280 et 420 px comparé à DESIGN.md : écarts
  corrigés (barre du haut, carte des missions en 1 colonne, labo, « Tout
  effacer » caché sur une mémoire vide, champ de fichier sans libellé).
- L'accueil guidé reprend à l'étape atteinte.

Ce qui est **supposé, pas mesuré** :

- Que les textes des pannes réelles de Google contiennent « overloaded » ou
  un code 5xx (classés « surchargé ») : jamais vu en vrai.
- Le gain de chargement sur la connexion de Franco (seule la taille est
  mesurée).
- Le contraste et le clavier : vérifiés écran par écran sur captures et par
  un contrôle automatique simple (chaque bouton et champ visible a un nom) ;
  pas d'audit complet avec un lecteur d'écran.

Ce qui est faible :

- À 420 px, le panneau « Défi du jour » / mission couvre en partie le visage
  du personnage (le téléphone reste hors périmètre).
- Le premier fichier reste lourd (1 Mo non compressé : three.js et
  three-vrm, nécessaires à la scène de l'accueil).
- « Tout effacer » n'efface pas la copie du compte en ligne (dit à l'écran) :
  à faire quand les comptes seront activés.
- Le site de test montre toujours la dernière branche poussée.
- Deux tests Playwright sont sensibles à la lenteur de la machine sans GPU :
  la ligne « Chanson » de l'accueil (a échoué une fois sur la CI ; l'accueil
  lit maintenant ses données en parallèle) et le test du micro de l'accueil
  guidé avec le micro factice (a échoué 2 fois en suite complète sur cette
  machine, jamais seul ni sur la CI). La dernière suite complète : 21 sur 21.

## Auto-critique de la phase 7

Ce qui marche (mesuré dans la session de construction, Google et Groq
**simulés**, micro factice de Chromium, sans GPU, **sans haut-parleur** :
rien n'a été écouté) :

- Essai écrit (docs du jour) : Lyria 3.5 / 3 Clip / 3 Pro n'ont **pas de
  palier gratuit** (page des prix) et composent leur propre air ; Lyria
  RealTime est « instrumental only » ; la synthèse vocale Gemini (gratuite)
  parle ; les synthèses chantées libres sont en GPL-3.0 (18 à 25 Mo, `npm
  view`) ou sans version navigateur. Choix noté dans DECISIONS.md.
- Karaoké maison (WebAudio) : 8 chansons (5 du domaine public, 3 écrites
  pour la plateforme), chaque ligne vérifiée « une note par syllabe » (test
  de logique) ; décompte, accompagnement harmonisé, mots allumés sur
  l'horloge de la chanson (Playwright).
- Maya fredonne (sa bouche bouge : mesuré par le test), garde le rythme
  (posture visible sur les captures), applaudit ; trois façons de chanter.
- Note par mot : prononciation par le `PronunciationScorer` de la phase 6
  (la requête dit que c'est chanté) + rythme mesuré dans la page. Sur des
  prises **synthétiques** (tests de logique) : en rythme ≥ 95, retard
  constant de 220 ms trouvé et retiré, mot sauté 0, mot en retard de 450 ms
  < 75. Avec Groq : horodatages par mot pris en compte.
- Sans clé : rythme seul, et chanson assemblée par la page (Playwright,
  aucune requête sortante). Service en panne : le rythme reste noté.
- Chanson tirée des cartes de révision : la requête contient les bonnes
  formes et les syllabes par ligne ; la réponse est vérifiée, les paroles
  sont ajustées à l'air par le code.
- Rien d'audio dans IndexedDB (test qui lit le stockage). Captures
  vérifiées contre DESIGN.md à 1280 et 420 px ; lint, 193 tests de logique,
  Playwright au vert.

Ce qui est **supposé, pas mesuré** :

- **Tout ce qui s'entend** : le timbre du fredonnement (un synthétiseur à
  formants, pas une voix), l'équilibre avec l'accompagnement, la justesse des
  airs tapés à la main, l'harmonisation automatique.
- Que Gemini juge bien des mots **chantés** (voyelles tenues) : déjà
  incertain pour des mots lus (phase 6), plus encore ici.
- La mesure du rythme sur une vraie voix : un chant lié ne montre pas le
  début de chaque mot ; le seuil de voix est réglé sur des sons de synthèse.
  Le micro factice de Chromium (des bips) obtient 16 à 25 en rythme, ce qui
  est normal mais ne prouve rien.
- Le retard réel entre le son et le micro (casque sans fil, navigateur) :
  retiré automatiquement, jamais mesuré sur une vraie machine.
- Que Whisper horodate correctement du chant ; que les couplets de Gemini
  riment et tombent bien sur l'air.

Ce qui est faible :

- **Pas de duo chanté** : Maya fredonne. C'est l'alternative, pas la
  promesse du brief.
- Un retard constant est pardonné : quelqu'un qui chante toujours 0,3 s
  après la musique garde une bonne note de rythme (la page le lui dit).
- Avec des haut-parleurs, le micro entend la musique : la note de rythme
  serait faussée (casque conseillé, écrit à l'écran).
- La hauteur des notes chantées n'est pas jugée (seulement les mots et le
  rythme).
- Trois airs originaux très simples ; l'accompagnement est minimal.
- Les notes de chant ne créent pas de cartes de révision et n'entrent pas
  dans la note de prononciation (choix assumé).
- À 420 px, le panneau du karaoké prend la moitié basse de l'écran avant de
  chanter (il se réduit pendant la chanson).

## Auto-critique de la phase 6

Ce qui marche (mesuré dans la session de construction, Google et Groq
**simulés**, micro factice de Chromium, sans GPU) :

- Comparaison écrite des quatre options (docs du jour) : Groq ne donne pas de
  confiance par mot (doc) ; Azure accepte l'appel depuis le site (préflight
  CORS 204, fausse clé 401, **mesuré**) ; poids des modèles phonétiques
  ONNX **mesuré** (197 Mo à 1,26 Go ; 355 Mo). Choix noté dans DECISIONS.md.
- Exercice : une prise du micro choisi (arrêt sur silence ou « J'ai fini »)
  part en WAV à Gemini avec la phrase et le schéma JSON, et à Groq en
  `verbose_json` + horodatage par mot ; note par mot (✓ ~ ✗ + chiffre), sons
  à travailler, conseils, « La machine a entendu » (test Playwright).
- Contrôle Whisper : un mot non reconnu est plafonné à 55 (tests de logique).
- Azure : en-tête et lecture de la réponse testés sur l'exemple de la doc.
- Cartes FSRS « Prononciation » créées sous 60, notées par le score quand le
  mot revient, visibles dans les révisions ; la carte due ouvre l'exercice
  (Playwright).
- Rien d'audio dans IndexedDB : seulement la phrase et les notes (test qui lit
  le stockage). « Mes progrès » : barre « Prononciation » et sons à
  travailler. Captures vérifiées contre DESIGN.md à 1280 et 420 px ; lint,
  161 tests de logique, Playwright au vert.

Ce qui est **supposé, pas mesuré** :

- **La justesse de Gemini comme juge de prononciation** : la doc de Google ne
  promet rien sur la prononciation. Risques : trop gentil, problèmes
  inventés, notes qui varient d'un essai à l'autre. C'est le risque principal
  de la phase.
- Que Whisper repère les mots vraiment mal dits (il est fait pour comprendre
  les accents ; son modèle de langue devine des mots).
- La forme réelle d'une réponse Azure (jamais reçue) et que la notation de
  prononciation consomme bien les 5 h gratuites (doc floue).
- Le seuil de voix qui arrête la prise avec un vrai micro et une vraie voix.

Ce qui est faible :

- Les sons difficiles sont repérés d'après l'orthographe (règles écrites à la
  main) : « car » n'est pas marqué « r », quelques mots seront mal classés.
- L'accent du mot n'est jugé que par Gemini (Azure ne donne pas d'accent par
  mot dans sa réponse REST) ; aucune mesure acoustique de l'accent.
- La note de prononciation reste **hors du niveau B1/B2/C1** (choix assumé :
  phrases lues, autre mesure) ; à revoir avec Franco.
- « Écouter le modèle » dépend des voix installées sur l'ordinateur.
- Une phrase lue n'est pas une conversation : la prononciation pendant les
  conversations n'est pas notée (le bilan garde ses « prononciation
  (probable) » devinées).

## Auto-critique de la phase 5

Ce qui marche (mesuré dans la session de construction, Google et Groq
**simulés** pour les réponses positives, Chromium sans carte graphique) :

- Accueil en 6 étapes, ouvert tout seul seulement pour quelqu'un sans clé
  qui ne l'a pas fini ; « Plus tard » laisse l'accueil utilisable ; entrer
  dans une scène sans clé rouvre l'accueil à l'étape de la clé (plus
  d'ouverture automatique des réglages) ; « Revoir l'accueil guidé » dans les
  réglages (tests Playwright).
- Vérification des clés **contre les vrais serveurs, avec de fausses clés** :
  Google accepte l'appel depuis le site (CORS, en-tête `x-goog-api-key`) et
  répond 400 `API_KEY_INVALID` ; Groq répond 401 `invalid_api_key`. La clé
  n'est jamais mise dans l'adresse (test de logique).
- Test du micro avec le micro factice de Chromium : niveau affiché, « On
  t'entend bien ✓ », micro choisi gardé et utilisé pour la conversation.
- Niveau de départ choisi (A2) → le prompt du personnage dit « at about A2
  level (a first estimate) » (test Playwright qui lit la configuration Live).
- Un vrai PDF de 2 pages (fabriqué dans le test) lu par PDF.js 6.5.438 dans
  le navigateur : titre trouvé, lignes recollées, passages ; gardé après
  rechargement (IndexedDB v4).
- Mots difficiles : une requête JSON à Gemini Flash avec **seulement le
  passage** ; les mots choisis deviennent des cartes FSRS « français →
  anglais » (dues le lendemain), un mot peut être ajouté à la main.
- Étude : le passage arrive dans le prompt, entre marqueurs, avec la consigne
  de ne pas suivre d'instructions écrites dans le document ; le bilan est
  prévenu (vocabulaire du passage). Panneau « Étude d'un document ».
- Lien web : page autorisée (CORS) importée sans exécuter ses scripts ; page
  refusée → message en français avec l'astuce « Enregistrer au format PDF ».
- Captures vérifiées contre DESIGN.md, à 1280 et à 420 px (pas de
  défilement horizontal) ; lint, 141 tests de logique, Playwright au vert.

Ce qui est **supposé, pas mesuré** :

- Les clics exacts d'AI Studio (« Create API key », conditions à accepter,
  projet créé tout seul) et de Groq (« Log In », « Create API Key ») : lus
  dans la documentation et la page publique, **pas avec un vrai compte**.
  Google dit que les nouvelles clés sont des « auth keys » depuis mai 2026
  sans dire leur forme : je ne vérifie plus qu'elles commencent par « AIza ».
- Qu'une vraie clé passe la vérification (200 attendu) et que la clé gratuite
  puisse lister les modèles.
- Le seuil du test du micro avec une vraie voix (réglé sur les bips du micro
  factice).
- La qualité du texte de vrais PDF (colonnes, tableaux, notes, en-têtes
  répétés) ; la qualité des mots difficiles ; le comportement du personnage
  en étude (questions, explications, ne pas lire le texte).

Ce qui est faible :

- Pas d'OCR : un PDF scanné n'a pas de texte (message clair, rien de plus).
- La découpe en paragraphes est faite par règles : une ligne courte sans
  point suivie d'une majuscule est prise pour un titre (peut couper une
  phrase en deux) ; les en-têtes et pieds de page répétés restent dans le
  texte.
- La plupart des sites d'actualité refusent la lecture depuis le navigateur
  (CORS) : le lien web marchera rarement ; le PDF reste la voie principale.
- Un document peut contenir des instructions cachées : la consigne au modèle
  réduit le risque, sans le supprimer.
- Le choix du micro n'est pas proposé dans Firefox avant la première
  permission (les noms des micros n'apparaissent qu'après).
- L'accueil ne reprend pas à l'étape où l'ami s'était arrêté (il recommence
  au début, les choix déjà faits restent).

## Auto-critique de la phase 4

Ce qui marche (mesuré dans la session de construction, Google **simulé**,
Chromium sans carte graphique) :

- Cartes de révision créées à partir des bilans (les anciens bilans sont
  convertis une fois) : une carte par bonne forme, les fautes de
  « prononciation » devinées sont écartées ; planification par `ts-fsrs`
  6.0.0 (modèle FSRS-7) : « Je l'avais » repousse la carte de plusieurs jours,
  « Raté » la ramène le lendemain ; tout est gardé après rechargement.
- Révisions à voix haute (auto-notées) : carte par carte, réponse cachée,
  quatre boutons, retrait d'une carte ; le compteur baisse (test Playwright).
- Défi du jour : le prompt envoyé à Google contient les fautes à reprendre
  (sans la réponse côté écran), les expressions et la durée ; une expression
  dite est cochée tout de suite ; le schéma envoyé à l'analyseur contient
  exactement les cartes et les expressions prévues ; après le bilan, forme
  réussie → plus tard, même faute → demain, expression placée → plus tard
  (test Playwright : 5 cartes dues → 2).
- Missions : 9 missions, carte à 3 niveaux, verrouillage écrit en clair ;
  le rôle de la mission remplace la scène habituelle dans le prompt ; mot
  interdit repéré en direct et mission ratée (40/100 au plus) quoi que dise
  le modèle (test Playwright).
- Série : jours ≥ 3 min de parole mesurée, joker hebdomadaire, record ;
  testée sur des cas de calendrier (tests de logique).
- Lint, 116 tests de logique, 10 tests Playwright au vert (un par un, comme
  en CI ; en parallèle sur cette machine sans GPU, deux anciens tests de
  gestes et de bilan dépassent parfois leur délai).

Ce qui est **supposé, pas mesuré** :

- Que le personnage (`gemini-3.8-live`) tende vraiment des perches pour les
  anciennes fautes **sans donner la réponse**, joue le rôle de la mission et
  remarque les expressions placées, sans en faire trop.
- Que `gemini-3.8-flash` juge bien « bonne forme / même faute / pas venue »
  et la réussite d'une mission ; la note sur 100 d'une mission est une
  estimation, comme les sous-notes.
- Qu'un défi de 5 minutes donne 3 minutes de voix de l'apprenant (le
  personnage parle aussi) : peut-être pas ; le panneau montre le compteur.
- Le délai de création des cartes : environ 3 s ici pour 6 cartes, car le
  rendu 3D sans GPU occupe le navigateur ; attendu bien plus court sur la
  GTX 1070.

Ce qui est faible :

- Les révisions rapides ne sont pas écoutées : l'apprenant se note
  lui-même (honnêteté requise). La reconnaissance vocale du navigateur
  n'existe pas dans Firefox, que Franco utilise ; une vraie écoute
  demanderait Gemini ou Groq (clé, quota). Seul le défi est jugé par l'IA.
- Une carte « faute » est identifiée par sa bonne forme : deux phrases
  différentes avec la même correction ne font qu'une carte, mais une
  correction légèrement différente en fait une nouvelle.
- Le repérage en direct des expressions est fait par motifs (formes
  régulières, « be », quelques formes irrégulières écrites à la main) : il
  peut rater une forme rare ; le bilan ne peut qu'ajouter « placée », jamais
  retirer une expression repérée dans le texte.
- Les missions et les expressions sont écrites à la main (9 + 18) ; pas
  encore adaptées au niveau, au-delà des 3 niveaux de la carte.
- Les cartes ne vont pas encore dans le compte Supabase (tout en local).
- Le compte à rebours n'arrête pas la conversation (choix assumé).

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

- Fin de la chaîne autopilote. **Rien jusqu'au retour de Franco.** À son
  retour : il suit le guide complet, puis Claude corrige d'après ses
  remarques (une phase de corrections, modèle conseillé Opus 5.5, branche
  partie de `phase-8`), puis Franco décide de la fusion dans `main` et de
  l'invitation des amis.

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
| 2026-11-10 | Phase 4 | Révisions FSRS (ts-fsrs 6.0.0) de ses propres fautes et des mots des bilans, à voix haute et auto-notées ; défi du jour de 5 minutes avec fautes à reprendre et expressions à placer, jugé par le bilan qui met les cartes à jour ; 9 missions sur une carte à 3 niveaux, réussies ou ratées avec une note ; expressions cochées en direct et remarquées par le personnage ; série de jours ≥ 3 min de parole avec un joker par semaine. Testé avec Google simulé | En attente (autopilote) |
| 2026-11-10 | Phase 2 | DESIGN.md + styles partagés ; accueil (lieu + personnage) ; 5 personnages VRoid gratuits allégés (Jake, Emma, Maya, Ollie en veste, Lily 9 ans) ; décors toon café / bureau / rue ; marche, salut, hochement, rire, réflexion, check du poing déclenchés par la conversation ; voix et prompt par personnage ; mesures repliables avec images/s. Testé avec Google simulé, sans GPU | En attente (autopilote) |
| 2026-11-10 | Phase 5 | Accueil guidé en français en 6 étapes (confidentialité, clé Gemini gratuite vérifiée, clé Groq facultative, choix et test du micro, niveau de départ, premier personnage), revisible depuis les réglages ; documents : import PDF lu dans le navigateur (PDF.js 6.5.438), passages, mots difficiles (Gemini Flash) ajoutés aux révisions FSRS, étude d'un passage avec un personnage, lien web seulement si le site l'autorise (CORS). Testé avec Google simulé | En attente (autopilote) |
| 2026-11-10 | Phase 6 | Comparaison écrite des options de notation (Gemini, Groq Whisper, Azure, modèles dans le navigateur) ; exercice « Prononciation » derrière `PronunciationScorer` : Gemini par défaut, contrôle Groq Whisper facultatif, Azure facultatif ; 5 phrases (révisions, tes fautes et tes mots, sons th / h / r / voyelles / -ed / accent) ; note par mot et sons à travailler ; cartes FSRS « Prononciation » notées par le score ; « Mes progrès » : barre prononciation (estimation, hors niveau) et sons à travailler ; aucune voix gardée. Testé avec Google et Groq simulés | En attente (autopilote) |
| 2026-11-10 | Phase 7 | Essai écrit « qu'est-ce qui peut chanter gratuitement ? » (aucune voix chantée gratuite ne suit nos notes : Lyria payant, voix Gemini parlées, synthèses libres en GPL ou trop lourdes) ; karaoké maison en WebAudio : 8 chansons (5 du domaine public, 3 écrites pour la plateforme), paroles allumées en rythme, Maya qui fredonne, garde le rythme et applaudit, trois façons de chanter ; note par mot : prononciation (`PronunciationScorer`, prévenu que c'est chanté) et rythme mesuré dans le navigateur (affiné par Groq Whisper) ; chanson écrite à partir des fautes et des mots du jour (Gemini, ou assemblée sans clé) ; aucune voix gardée. Testé avec Google et Groq simulés, rien n'a été écouté | En attente (autopilote) |
| 2026-11-10 | Phase 8 | Finition : « Mes données » dans les réglages (tout ce qui est gardé, effaçable par ligne ou en entier ; chansons et notes de chant effacées avec les conversations) ; barre du haut sur 2 lignes à 420 px ; tour des 19 écrans à 1280 et 420 px contre DESIGN.md (carte des missions, labo, libellés) ; bibliothèque Google chargée au premier « Démarrer » (365 → 285 Ko au premier chargement) ; erreurs qui disent toutes quoi faire ; l'accueil reprend à l'étape atteinte ; guide complet du retour (2 h en 5 séances). Testé avec Google simulé | En attente (autopilote terminé) |

## Points ouverts

- Vraie voix chantée : bouton facultatif « chanson complète » avec Lyria 3.5
  (payant, environ 0,08 $ la chanson, à écouter, pas à noter) si Franco le
  veut ; essayer `gemini-3.8-flash-tts` avec une vraie clé pour entendre ce
  que donne un style « chanté ».
- Karaoké : juger la hauteur des notes chantées (détection de hauteur dans
  le navigateur) ; plus de chansons ; choisir le personnage qui accompagne.
- Chant : mettre les chansons et les notes de chant dans le compte Supabase
  quand les comptes seront activés (l'effacement est fait en phase 8).
- « Tout effacer » : effacer aussi la copie du compte en ligne quand les
  comptes seront activés.
- Déploiement : ne publier que `main` (et un aperçu séparé pour les branches)
  une fois la fusion faite.

- Prononciation dans le niveau estimé : laissée à part (phrases lues) ; à
  décider avec Franco après son test.
- Modèle phonétique dans le navigateur (200–350 Mo) : seulement si Gemini et
  Azure déçoivent.
- Noter la prononciation pendant les conversations (pas seulement en phrases
  lues) : demanderait d'envoyer chaque tour à un notateur (quota).

- OCR des PDF scannés (Tesseract.js, gratuit, lourd) : si Franco le veut.
- Documents dans le compte Supabase : non (texte complet local, comme le
  brief) ; seulement les cartes, quand les comptes seront activés.

- Révisions écoutées par la machine (Gemini ou Groq qui vérifie la phrase
  dite) au lieu de l'auto-notation : à décider avec Franco (coût en quota).
- Cartes de révision dans le compte Supabase : quand les comptes seront
  activés.
- Missions adaptées au niveau (plus de missions, missions écrites à partir
  des fautes) ; arrêt automatique du défi à 5 minutes si Franco le préfère.

- Nom définitif de la plateforme (provisoire : « English Buddy »).
- Quatrième personnage (conférence / école) : hors version 1.
- Fiches personnages `docs/characters.md` : plus nécessaires (Franco ne crée
  plus les personnages) ; les personas sont dans `src/teaching/persona.ts`.
- Gestes plus naturels : clips d'animation CC0 (par exemple Quaternius)
  adaptés au squelette VRM, si Franco trouve les gestes faits main trop
  raides. Chanter et danser (Maya) : fait en phase 7 (elle fredonne et garde
  le rythme).
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
- Score de prononciation dans le niveau estimé : phase 6 l'a gardé à part (voir plus haut).
- Clés Supabase : la clé « anon » sera retirée par Supabase fin 2026 ; le
  code accepte la nouvelle clé « publishable ».
