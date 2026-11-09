# Guide de test — phase 0

But de cette phase : vérifier les deux maillons les moins sûrs avant de
construire le reste — **la voix Gemini en direct et gratuite**, et **un
personnage 3D qui parle de façon crédible**.

Lien de test : <https://johnfrancis6.github.io/english-buddy/>

Durée : environ 20 minutes. Matériel : ton PC, Chrome, ton casque avec micro,
ta clé API Gemini.

> Le personnage est un modèle d'essai gratuit (pas encore « ton » Jake).
> Son apparence n'est pas à juger ici.

## Avant le premier test : activer le site (une seule fois)

1. Ouvre <https://github.com/Johnfrancis6/english-buddy>.
2. Clique sur **Settings** (onglet en haut à droite du dépôt).
3. Dans le menu de gauche, clique sur **Pages**.
4. Sous **Build and deployment**, dans la liste **Source**, choisis
   **GitHub Actions**. (Rien d'autre à enregistrer.)
5. Dans le menu de gauche, clique sur **Environments**, puis sur
   **github-pages**.
   - Si **github-pages** n'apparaît pas encore, passe à l'étape 7 : il sera
     créé au premier essai de déploiement, puis reviens ici.
6. Sous **Deployment branches and tags**, clique sur **Add deployment branch
   or tag rule**, laisse **Ref type : Branch**, tape `phase-*` dans
   **Name pattern**, puis clique sur **Add rule**.
7. Clique sur l'onglet **Actions** (en haut du dépôt), ouvre la ligne la plus
   récente « Build, test, deploy preview », puis clique sur **Re-run all
   jobs** (en haut à droite) et confirme.
8. Attends que les deux cases (**build** et **deploy**) passent au vert
   (3 à 5 minutes), puis ouvre le lien de test.

Si **deploy** reste rouge avec un message du type « Branch "phase-0" is not
allowed to deploy to github-pages », refais les étapes 5 et 6, puis l'étape 7.

## Test 1 — La page et la clé

1. Ouvre le lien de test dans Chrome. Jake se charge (un pourcentage
   s'affiche ; le fichier pèse 18 Mo, compte quelques secondes).
2. La fenêtre **Réglages** s'ouvre toute seule. Colle ta clé Gemini, clique
   sur **Enregistrer**.
3. Recharge la page (touche F5).

À regarder :

- [ ] La page s'ouvre sans message d'erreur.
- [ ] Après F5, la fenêtre Réglages ne se rouvre pas toute seule ; en
      cliquant sur **Réglages** tu vois « Clé enregistrée dans ce
      navigateur : AIza…xxxx ».

## Test 2 — Jake au repos (sans parler)

Regarde Jake pendant 30 secondes sans rien faire.

- [ ] Il te regarde (ses yeux sont tournés vers toi).
- [ ] Il cligne des yeux de temps en temps, à un rythme irrégulier.
- [ ] Il bouge un peu (respiration, léger balancement) ; rien n'est figé,
      rien n'est cassé (bras en l'air, tête de travers, trous dans le
      modèle).
- [ ] L'image est fluide (pas de saccades).

## Test 3 — Les lèvres, sans la clé

Clique sur **Tester les lèvres (sans clé)**. Tu entends 4 secondes d'un son
artificiel (pas une vraie voix), avec 1 seconde de silence au milieu.

- [ ] La bouche bouge pendant le son.
- [ ] La bouche se ferme pendant le silence et à la fin.

## Test 4 — La conversation

1. Mets ton casque. Clique sur **Démarrer**. Chrome demande l'accès au
   micro : clique sur **Autoriser**.
2. L'état passe à « Connexion à Jake… » puis « Jake t'écoute ». Jake devrait
   te saluer le premier.
3. Dis : **« Hey, how are you doing? »** puis continue à discuter
   normalement, une dizaine d'échanges.

À regarder :

- [ ] Jake répond en anglais, avec une voix naturelle, pas trop vite.
- [ ] Ses lèvres suivent sa voix et se ferment quand il se tait.
- [ ] La barre **Micro** bouge quand tu parles et devient verte.
- [ ] Après quelques échanges, **Délai médian** affiche une valeur.
      **Objectif : moins de 1,5 s** (vert). Note la valeur après 10 tours.
- [ ] Les phrases s'affichent à droite (« Toi : … », « Jake : … »). Elles ne
      sont pas enregistrées.

## Test 5 — Couper la parole

Pose une question qui demande une longue réponse (« Tell me about your
city »), puis parle par-dessus Jake au milieu de sa phrase.

- [ ] Jake s'arrête tout de suite (moins d'une seconde) et t'écoute.

## Test 6 — Dix minutes sans coupure

Discute 10 minutes d'affilée (regarde **Durée**). Vers 9–10 minutes, Google
ferme la connexion et l'application doit se reconnecter toute seule : une
ligne « reconnexion automatique » peut apparaître dans le journal.

- [ ] La conversation tient 10 minutes sans s'arrêter sur une erreur.
- [ ] Si une reconnexion a eu lieu : Jake se souvient-il de ce que vous
      disiez juste avant ?

**Si ça s'arrête** : ne ferme pas la page, clique sur **Copier le rapport**
et colle-le dans ta réponse, avec l'heure et ce que tu faisais.

## Test 7 — Les pannes (2 minutes)

- [ ] **Mauvaise clé** : dans Réglages, ajoute une lettre à la fin de ta
      clé, Enregistrer, Démarrer → un message en français dit que Google
      refuse la clé. Remets ensuite la bonne clé.
- [ ] **Micro refusé** (facultatif) : clique sur l'icône à gauche de
      l'adresse, bloque le micro, recharge, Démarrer → un message explique
      comment le réautoriser. Réautorise-le ensuite.
- [ ] **Coupure réseau** (facultatif) : pendant une conversation, coupe le
      Wi-Fi 20 secondes → un message propose **Reconnecter**.

## Ce que je te demande de me rapporter

1. Le **délai médian** après au moins 10 tours (et le modèle utilisé).
2. Le résultat du **test de 10 minutes** : tenu ou non ; si non, le rapport
   copié.
3. La voix : naturelle ? assez lente pour toi ?
4. Les lèvres : crédibles, ou gênantes ?
5. L'interruption : marche ou non.
6. Tout ce qui t'a paru bizarre, cassé ou lent (une capture d'écran aide).
7. Ton **feu vert** ou non pour passer à la phase 1.

Le bouton **Copier le rapport** rassemble les mesures et le journal (sans ta
clé et sans tes phrases) : colle-le simplement dans ta réponse.
