# Heures — suivi des présences

Application React pour suivre les présences à MIAGE et ECIG, calculer les honoraires et exporter un récapitulatif Excel.

## Utilisation

```bash
npm install
npm run dev
```

Sans variables Firebase, les données sont enregistrées dans le stockage local du navigateur. Elles ne se synchronisent pas entre appareils.

## Firebase configuré

- Projet : `trackhours-miage-ecig-26`
- Base Cloud Firestore : région `europe-west1`
- Authentification anonyme activée
- Règles Firestore : chaque compte ne peut lire et modifier que ses propres présences
- Hébergement : https://trackhours-miage-ecig-26.web.app

La configuration de l’application Web est dans `.env` (ignoré par Git). Pour redéployer après une modification :

```bash
npm run deploy
```

La commande reconstruit l’application, active le fournisseur d’authentification anonyme, publie les règles Firestore puis déploie Firebase Hosting.

L’authentification anonyme conserve l’accès dans le navigateur courant. Pour retrouver les mêmes données depuis un autre appareil, il faudrait ajouter une connexion avec compte et associer le compte anonyme à cette méthode.
