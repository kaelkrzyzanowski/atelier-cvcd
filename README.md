# Atelier CVCD — calculateurs de chantier

Application Android (et page web) qui reprend **uniquement les outils de calcul** de la formation « Atelier CVCD »,
pour faire des pré-sélections rapides sur un chantier : puissance ↔ débit ↔ ΔT (air ou eau), air neuf, CTA, ventilateur, gaine, air humide, déperditions,
bilan frigorifique, réseau hydraulique, vase d'expansion, charge de fluide (NF EN 378), désenfumage, BACS, décret tertiaire…

- Fonctionne **entièrement hors ligne**, sans aucune permission Android.
- Les dernières valeurs saisies sont gardées pour chaque outil (bouton « Valeurs par défaut » pour revenir aux valeurs d'origine).
- Bouton **Partager** : envoie les données et les résultats en texte (SMS, WhatsApp, Gmail, Keep…).
- Les champs de température ont un bouton **±** (le clavier numérique n'a pas toujours de signe moins).

Les résultats sont des **ordres de grandeur indicatifs** : ils ne remplacent pas une note de calcul.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `src/calcs.js` | Physique (air humide, Colebrook…), tables et définition des 19 calculateurs, repris tels quels de la version web |
| `src/inputs.js` | Lecture des nombres « à la française » (virgule, espaces, signe −) et valeurs par défaut |
| `src/main.js` | Interface : liste des outils (`#/`) et écran d'un outil (`#/cta`, `#/gaine`…) |
| `src/native.js` | Spécifique à Android : bouton retour, couleur de la barre d'état, feuille de partage |
| `src/style.css` | Styles (thème clair et sombre) |
| `test/calcs.test.js` | Tests : chaque calculateur doit redonner les valeurs de l'auto-test de la version web |
| `scripts/gen-icons.mjs` | Dessin de l'icône et de l'écran de démarrage |
| `android/` | Projet Android généré par Capacitor (ne modifier que ce qui est commenté) |
| `.github/workflows/android.yml` | Construction et signature de l'APK par GitHub Actions |

Pour **ajouter ou corriger un calculateur**, il suffit de modifier `CALCS` dans `src/calcs.js`, puis de le ranger dans
une rubrique (`GROUPS` dans `src/main.js`).

## Versions utilisées

| Outil | Version |
|---|---|
| Node.js | 22 ou plus récent (testé avec 24) |
| Capacitor | 8 |
| Android | minSdk 24 (Android 7.0), compileSdk / targetSdk 36 (Android 16) |
| JDK (seulement pour compiler en local) | 21 |
| Gradle | celui du projet (`android/gradlew`), téléchargé automatiquement |

## Développer et tester sur l'ordinateur

```bash
npm install
npm run dev        # ouvre l'app dans le navigateur (http://localhost:5173)
npm test           # vérifie tous les calculs
npm run build      # version finale dans dist/
```

Dans le navigateur, la touche F12 puis l'icône « téléphone » (barre d'outils des outils de développement) affiche l'app
à la taille d'un téléphone.

## Publier une nouvelle version (APK)

L'APK est construit et signé par **GitHub Actions**, pas sur ce PC. Pour publier la version 1.1.0 :

```bash
npm version 1.1.0 --no-git-tag-version
git commit -am "Version 1.1.0"
git tag v1.1.0
git push origin main --tags
```

GitHub Actions lance les tests, construit l'APK signé et crée la release `v1.1.0` avec `atelier-cvcd-1.1.0.apk`.
Le workflow peut aussi être lancé à la main (onglet **Actions** → « APK Android » → **Run workflow**) : l'APK est alors
dans les « Artifacts » du build, sans release.

## Installer l'APK sur le téléphone

1. Sur le téléphone, ouvrir la page **Releases** du dépôt GitHub et télécharger `atelier-cvcd-X.Y.Z.apk`.
2. Ouvrir le fichier. Android demande d'autoriser l'installation depuis le navigateur ou l'app Fichiers : autoriser
   (on peut retirer l'autorisation ensuite).
3. Installer, puis ouvrir **Atelier CVCD**.

**Mises à jour** : installer le nouvel APK par-dessus. Les valeurs saisies sont conservées, à condition que l'APK soit
signé avec la même clé (c'est le cas de tous les APK publiés par le dépôt).

## Clé de signature

- Créée une seule fois, **hors du dépôt**, dans `C:\Users\kaelk\atelier-cvcd-signature\`
  (`atelier-cvcd.p12`, `MOT-DE-PASSE.txt`, `atelier-cvcd.p12.base64.txt`). **À copier en lieu sûr** (clé USB,
  gestionnaire de mots de passe).
- Une copie est stockée dans les **secrets GitHub** du dépôt : `ANDROID_KEYSTORE_BASE64` (contenu de
  `atelier-cvcd.p12.base64.txt`) et `ANDROID_KEYSTORE_PASSWORD` (2e ligne de `MOT-DE-PASSE.txt`).
- **Si la clé est perdue**, les APK suivants ne pourront plus mettre à jour l'app installée : il faudra la désinstaller
  puis installer le nouvel APK (seules les dernières valeurs saisies sont perdues).
- L'identifiant `fr.ateliercvcd.app` ne doit jamais changer : le modifier créerait une autre application.

## Compiler en local (facultatif)

Il faut **Android Studio** (avec le SDK Android 36) et un **JDK 21** (Android Studio en embarque un).

```bash
npm run build
npx cap sync android
npx cap open android
```

Dans Android Studio :

- **Émulateur** : *Device Manager* → créer un appareil (ex. Pixel 8, Android 16), puis bouton ▶ *Run*.
- **Téléphone en USB** : sur le téléphone, *Paramètres → À propos → Numéro de build* (taper 7 fois) pour activer le
  mode développeur, puis *Options pour les développeurs → Débogage USB*. Brancher le téléphone, accepter l'empreinte
  de l'ordinateur, le choisir dans la liste des appareils et cliquer sur ▶.
- **APK de debug** : *Build → Build App Bundle(s) / APK(s) → Build APK(s)* → `android/app/build/outputs/apk/debug/`.

Après toute modification du code web : `npm run build` puis `npx cap sync android`.
Après une modification de l'icône : `npm run icons`.
