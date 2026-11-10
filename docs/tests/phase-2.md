# Guide de test — phase 2 (personnages et scènes)

Lien : <https://johnfrancis6.github.io/english-buddy/> (dans Chrome ou
Firefox, avec ton casque). Compte environ 30 minutes.

À tester **après** le guide de la phase 1 (même clé Gemini).

## Ce qui est nouveau

- Un **écran d'accueil** : tu choisis le lieu (café, bureau, rue) et le
  personnage. Le décor change en direct derrière.
- **Cinq personnages** gratuits : Jake (café, américain), Emma (bureau,
  britannique), Maya (rue, américaine), Ollie (en veste, britannique) et
  Lily (une fillette de 9 ans, américaine).
- Des **gestes** : le personnage arrive en marchant, salue, hoche la tête
  quand tu parles, réfléchit (main au menton), rit, fait un check du poing
  (Jake, Ollie, Lily).
- Les **mesures de test** sont repliées en haut à gauche (« Mesures de
  test ») : un clic pour les ouvrir. Elles montrent aussi les **images par
  seconde**.
- Un style commun à tous les écrans (couleurs, boutons, fenêtres).

## 1. L'accueil (3 minutes)

1. Ouvre le lien. Tu vois « Avec qui veux-tu parler aujourd'hui ? ».
2. Clique sur « Le bureau » : le décor devient un bureau et **Emma** est
   choisie. Clique sur « La rue » : **Maya**.
3. Clique sur chaque personnage. La première fois, chacun se charge (4 à
   5 Mo, quelques secondes) ; ensuite c'est immédiat.

À regarder : le décor et le personnage changent bien ; les vignettes sont
lisibles ; rien n'est caché ou coupé.

## 2. Entrer dans une scène (2 minutes)

1. Choisis le café avec Jake, clique sur « Entrer : le café avec Jake ».
2. Jake arrive **en marchant** depuis la droite, se tourne vers toi.
3. Ouvre « Mesures de test » (en haut à gauche) et note la ligne
   **Images/s** (le nombre d'images par seconde). Sur ta GTX 1070, on attend
   **55 à 60**.
4. Clique sur « Tester les gestes » : il salue, hoche la tête, rit, réfléchit,
   fait un check du poing (environ 14 secondes).

À regarder : la marche est-elle naturelle ou raide ? Les gestes sont-ils
sobres ? Un geste a-t-il l'air cassé (bras dans le corps, main tordue) ?

## 3. Une conversation par personnage (15 minutes)

Pour **Jake (café)**, **Emma (bureau)** et **Maya (rue)**, puis si tu veux
Ollie et Lily :

1. « Changer de scène » (en haut), choisis le lieu et le personnage, entre.
2. « Démarrer », parle environ 3 minutes, puis « Arrêter ».
3. Essaie de provoquer :
   - un **rire** : raconte une petite blague ou une anecdote drôle ;
   - un **hochement** : parle longtemps (plus de 5 secondes) ;
   - **réfléchir** : fais une longue phrase, puis tais-toi ;
   - un **check du poing** (Jake) : annonce une bonne nouvelle (« I got the
     job! ») ;
   - un **salut** : dis « bye, I have to go ».

À regarder :

- **Accent** : Emma et Ollie parlent-ils avec un accent britannique ? Jake,
  Maya et Lily avec un accent américain ? (L'accent est demandé dans le
  prompt ; la voix elle-même n'a pas d'accent réglable.)
- **Voix** : chaque personnage a sa voix (Jake Puck, Emma Kore, Maya Aoede,
  Ollie Orus, Lily Leda). Si une voix est refusée par Google, un message
  d'erreur s'affiche : note lequel.
- **Gestes au bon moment** : le salut arrive-t-il avec « Hello » ? Le rire
  arrive-t-il avec le rire de la voix (ou trop tôt / trop tard) ? Les
  hochements te gênent-ils ?
- **Personnalité** : Emma pose-t-elle des questions de travail exigeantes
  mais polies ? Lily parle-t-elle simplement, comme une enfant ?
- **Bilan** : à la fin, le bilan s'ouvre et dit « avec Emma » (ou le bon
  personnage) ; la phrase « Emma l'a reformulé » apparaît sous une faute
  reprise par elle.

## 4. Les autres écrans (3 minutes)

- **Réglages** : la ligne « Voix » propose « Celle du personnage
  (recommandé) ». Garde ce choix.
- **Mon dernier bilan** (accueil ou bas de l'écran) : il rouvre la dernière
  conversation, avec le bon personnage.
- **Labo transcription** : même style que le reste ; il marche comme en
  phase 1 (sa voix d'écoute ne dépend pas du personnage).

## Ce qu'il faut m'envoyer

1. Pour chaque personnage testé : « Copier le rapport » (dans « Mesures de
   test »), colle-le dans ta réponse. Il contient les images par seconde, le
   personnage, la scène et la voix.
2. En quelques mots :
   - les images par seconde sur ta GTX 1070 (café, bureau, rue) ;
   - les accents (corrects ou non, personnage par personnage) ;
   - les gestes : naturels, raides, mal placés, trop fréquents ? Lequel
     garder, lequel retravailler ?
   - les personnages : lesquels garder, lesquels changer (les modèles sont
     des exemples gratuits de VRoid, style manga) ;
   - l'accueil et le style : clair, agréable, quelque chose à changer ?
3. Go / no-go pour la phase 3 (mémoire et progrès).

## Ce qui a été vérifié sans toi (session de construction)

- Mesuré, avec Google **simulé** : prompt d'Emma (accent britannique, scène
  du bureau) et sa voix « Kore » envoyés à Google ; salut au premier
  « Hello » ; rire sur « Haha » ; bilan qui parle d'Emma ; ancien bilan de
  la phase 1 relu correctement ; 68 tests de logique et 5 tests Playwright au vert.
- Mesuré dans le navigateur de test (sans carte graphique, rendu logiciel) :
  130 à 300 dessins et 40 000 à 55 000 triangles par image, 2 à 8 images
  par seconde. Ce chiffre ne dit rien de ta GTX 1070 : **c'est toi qui
  mesures**.
- **Non vérifié** : vraie conversation, accents réels, acceptation des voix
  Kore / Aoede / Orus / Leda par `gemini-3.8-live` (seule Puck a été
  mesurée en phase 0), moment exact des gestes avec une vraie voix.
