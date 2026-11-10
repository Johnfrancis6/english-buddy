# Guide de test — phase 1

But de cette phase : transformer la discussion avec Jake en **vraie séance
d'anglais** — Jake te reprend en douceur pendant la conversation (il répète ta
phrase sous la bonne forme, sans faire de leçon), tu vois le texte de la
conversation à l'écran, et à la fin tu reçois un **bilan en français** avec
tes fautes classées par type et un bouton **« Pourquoi ? »** sur chacune.

Lien de test : <https://johnfrancis6.github.io/english-buddy/>

Durée : environ 45 minutes (on peut le faire en deux fois). Matériel : ton
PC, ton casque avec micro, ta clé Gemini. Facultatif : une clé Groq gratuite
(voir test 1).

> Rien à activer cette fois : GitHub Pages est déjà réglé. Si la page affiche
> encore « phase 0 » en haut à gauche, attends quelques minutes (le site se
> met à jour 3 à 5 minutes après mon envoi) puis recharge avec **Ctrl+F5**.

## Ce que j'ai vérifié moi-même, et ce que je n'ai pas pu vérifier

Je n'ai **aucune clé** dans ma session : je n'ai pas parlé avec le vrai Jake
ni reçu un vrai bilan de Google.

- **Vérifié par des tests automatiques**, avec Google et Groq *simulés* :
  le prompt de Jake part bien vers Google, le texte s'affiche tour par tour,
  le bilan est demandé au bon format et s'affiche avec les fautes par type,
  « Pourquoi ? » fonctionne, la conversation revient après F5, le labo
  compte bien les fautes gardées ou corrigées, et le texte Groq remplace
  celui de Gemini quand tu choisis Groq.
- **Mesuré depuis ma session** : Google et Groq acceptent les appels depuis
  la page (pas de blocage du navigateur) ; Google connaît bien le champ du
  format JSON du bilan ; une fausse clé Groq donne « Invalid API Key ».
- **Pas vérifié (c'est à toi)** : la qualité réelle des reprises de Jake, la
  justesse du bilan, quelle transcription garde le mieux tes fautes, la
  vitesse du bilan, et les points restés ouverts en phase 0 (test 5).

## Test 1 — Le labo transcription (à faire en premier, 10 min)

Pourquoi : en phase 0 tu as vu tes mots mal écrits alors que Jake te
comprenait. Le texte vient d'une autre machine que celle qui répond. Le bilan
corrige **ce texte** : s'il « répare » tes fautes en silence, le bilan ne peut
pas les voir. Le labo compare plusieurs machines sur les mêmes phrases.

### 1a. (Facultatif mais conseillé) Créer une clé Groq gratuite

Sans clé Groq, le labo compare seulement les deux sources de Google, et tout
le reste marche quand même.

1. Ouvre <https://console.groq.com/keys>.
2. Connecte-toi (par exemple avec ton compte Google). C'est gratuit, sans
   carte bancaire.
3. Clique sur **Create API Key**.
4. Tape un nom, par exemple `english-buddy`, puis valide (**Submit**).
5. Clique sur l'icône de copie à côté de la clé (elle commence par `gsk_`).
   **Elle ne s'affiche qu'une seule fois** : colle-la tout de suite dans le
   labo (étape 1b).

> Les noms exacts des boutons viennent de guides récents, pas de la doc
> officielle de Groq ; s'ils diffèrent un peu, dis-le-moi.

### 1b. Lire les 12 phrases

1. Sur la page de test, clique sur **Labo transcription** (en haut à droite).
2. Ta clé Gemini est déjà remplie. Colle ta clé Groq si tu l'as.
3. Clique sur **Commencer**, autorise le micro. L'état passe à « Connecté ».
4. Pour chaque phrase :
   - clique sur **🎙 Enregistrer** ;
   - lis la phrase **exactement comme elle est écrite, fautes comprises**, à
     ton rythme normal (ne corrige pas en lisant !) ;
   - clique sur **■ J'ai fini** ; Google dit « Okay » ; attends les
     résultats (quelques secondes) ;
   - clique sur **Suivante →**.
5. Après les 12 phrases, regarde le tableau **Résultats** et la ligne
   **Recommandation**.
6. Clique sur **Copier les résultats** et colle-les dans ta réponse.
7. Si la recommandation te paraît juste, clique sur **Utiliser cette source
   pour Jake**.

À regarder :

- [ ] Chaque ligne affiche ce que la machine a écrit, avec pour chaque faute
      ✓ gardée, ✗ corrigée en silence, ou ? mal entendue.
- [ ] La ligne « Gemini Live (actuel) » : garde-t-elle tes fautes ? (C'est
      aussi le test de l'indice de langue anglais ajouté en phase 0.)

## Test 2 — Une conversation avec Jake (10 min)

1. Reviens sur la page principale (**← Retour à Jake**).
2. Ouvre **Réglages** et vérifie : ta clé Gemini, ton rythme (Rapide),
   « Qui écrit tes phrases » (la source choisie au test 1), modèle du bilan
   « Gemini 3.8 Flash ». Clique sur **Enregistrer**.
3. Clique sur **Démarrer**, et discute 8 à 10 minutes, comme avec un ami.
4. Glisse **volontairement** quelques fautes typiques dans tes phrases, par
   exemple :
   - « Yesterday I **go** to the restaurant with my wife. »
   - « I **am agree** with you. »
   - « My boss **said me** that… »
   - « It **depends of** the weather. »
5. Une fois, demande-lui : « Is it correct to say *I am agree*? »
6. Une fois, demande-lui un mot en français : « How do you say *une
   facture* in English? »

À regarder :

- [ ] Jake **reprend** tes fautes en douceur : il réutilise la bonne forme
      dans sa réponse (« Oh, you **went** to the restaurant? ») **sans** faire
      de leçon, sans dire « tu aurais dû dire… ».
- [ ] Ses tours sont **courts** (1 à 3 phrases) et finissent souvent par
      **une** question ouverte (what, how, why…).
- [ ] Quand tu demandes si c'est correct, il répond en une phrase puis
      revient à la discussion.
- [ ] Le panneau **Ce qui se dit** (en bas à droite) montre le texte au fur
      et à mesure. Le bouton **Masquer** le cache si tu préfères écouter sans
      lire.
- [ ] Avec Groq : ta phrase s'affiche d'abord telle que Gemini l'a
      entendue, passe en gris quand Jake commence à répondre, puis est
      remplacée par le texte de Groq une à deux secondes après.
- [ ] Le délai médian reste comme en phase 0 (environ 1 à 1,5 s). Le prompt
      de Jake est plus long ; je ne pense pas que ça change le délai, mais
      ce n'est pas mesuré.

## Test 3 — Le bilan en français (5 min)

1. Clique sur **Arrêter**. La fenêtre **Ton bilan** s'ouvre : « Jake prépare
   ton bilan… » (compte 10 à 30 secondes ; non mesuré).
2. Lis le bilan.
3. Clique sur **Pourquoi ?** sous deux ou trois fautes.
4. Clique sur **Copier le bilan** et colle-le dans ta réponse.
5. Ferme, recharge la page (F5), puis clique sur **Mon dernier bilan** : le
   même bilan revient, et les explications déjà ouvertes reviennent sans
   attendre.

À regarder :

- [ ] Les fautes sont **classées par type** (temps du verbe, prépositions…),
      chacune avec ce que tu as dit (barré en rouge), la bonne forme (en
      vert) et une explication courte en français.
- [ ] Chaque faute listée est une faute que **tu as vraiment faite** (pas
      une faute inventée, pas une erreur de la transcription).
- [ ] Les fautes volontaires du test 2 sont **toutes** dans le bilan ; dis-moi
      lesquelles manquent.
- [ ] « Pourquoi ? » donne une explication plus longue, claire, avec des
      exemples traduits.
- [ ] La mention « Jake l'a reformulé pendant la conversation » correspond à
      ce que tu as entendu.
- [ ] En bas, **Toute la conversation (texte)** montre toute la
      conversation.

## Test 4 — Sans clé Groq (2 min)

Seulement si tu as utilisé Groq au test 2.

1. **Réglages** → efface le contenu de **Ta clé API Groq** (laisse la source
   sur Groq) → **Enregistrer**.
2. Le panneau du texte affiche « texte : Gemini Live » et le journal dit que
   Gemini Live sera utilisé.
3. Démarre une courte conversation (1 minute), arrête : le bilan marche.
4. Remets ta clé Groq ensuite.

## Test 5 — Points restés ouverts depuis la phase 0

- [ ] **Interruption** : pendant que Jake parle, coupe-le (« Wait, wait… »).
      Il s'arrête tout de suite ? Dans le texte, sa phrase coupée s'arrête
      net.
- [ ] **Lèvres** : en le regardant parler, les lèvres te semblent-elles
      crédibles (s'ouvrent quand il parle, se ferment dans les silences) ?
- [ ] **Chrome** : refais le test 2 (même 3 minutes) dans **Google Chrome**
      (tous tes essais étaient dans Firefox). Le micro et la voix
      marchent-ils pareil ?
- [ ] **Autres voix** : dans Réglages, essaie la voix **Charon** puis
      **Kore** pour une phrase chacune. Google les accepte-t-il ? (Remets
      Puck ensuite si tu préfères.)
- [ ] **Reconnexion vers 10 minutes** (facultatif) : si une conversation
      dépasse 10 minutes, regarde dans le journal s'il y a « Google annonce
      la fin de la connexion ». Si oui, la conversation continue-t-elle ?

## Ce que tu me renvoies

1. Les résultats du labo (bouton **Copier les résultats**).
2. Le **rapport** de la conversation du test 2 (bouton **Copier le rapport**
   dans le panneau Mesures — il ne contient ni ta clé ni le texte de la
   conversation).
3. Le **bilan** copié (test 3) — il contient tes phrases fautives ; ne le
   colle que si tu es d'accord.
4. Tes réponses aux cases à cocher, surtout : Jake fait-il des leçons ? Les
   fautes du bilan sont-elles justes ? Lesquelles manquent ?
5. **Go / no-go** pour la phase 2 (personnages et scènes), avec tes remarques.

## Confidentialité

- Tes clés restent dans ton navigateur. La clé Gemini ne part que chez
  Google, la clé Groq que chez Groq.
- Ta voix n'est **jamais enregistrée**. Avec Groq, le son de chaque phrase
  est gardé en mémoire le temps de l'envoyer à Groq pour qu'il l'écrive, puis
  oublié.
- Le texte de tes conversations et tes bilans restent dans ce navigateur (30
  dernières conversations). Bouton **Réglages → Effacer mes conversations**
  pour tout supprimer.
- Avec une clé gratuite, Google indique utiliser les échanges pour améliorer
  ses produits (c'était déjà le cas en phase 0).
