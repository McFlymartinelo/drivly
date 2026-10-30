# Drivly

Suivi de véhicules, local-first (IndexedDB). **PWA** (service worker, manifeste, icônes PNG).

```bash
npm install
npm run dev
```

Ouvre [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Fonctionnalités

- **Pleins** : consommation réelle (les pleins partiels sont reportés au plein complet suivant), coût au km, prix par station.
- **Entretiens, dépenses, revenus, relevés, itinéraires, listes de contrôle** : chaque entrée est consultable, modifiable et supprimable (avec annulation).
- **Rappels** : statut « à venir / bientôt / dépassé », suggestions automatiques déduites des intervalles d'entretien.
- **Rapports** : période (tout, 12 mois, année, personnalisée), export CSV pour la comptabilité.
- **Véhicules** : création avec marque, immatriculation, carburant, capacité du réservoir et kilométrage de départ.
- **Onboarding** : au premier lancement, créer son véhicule, importer une sauvegarde ou explorer la démonstration.

## Qualité

```bash
npm run typecheck   # TypeScript strict
npm run lint
npm test            # tests unitaires des calculs (vitest)
npm run build
```

Les calculs (consommation, agrégats, rappels, import) sont couverts par des tests : `src/utils/*.test.ts`.

## Données locales

- Les données restent dans le navigateur. L'app demande la **persistance du stockage** ; sur iOS, installez la PWA pour éviter l'éviction après quelques jours d'inactivité.
- **Export / import JSON** depuis l'écran **Plus** (ou le bouton d'en-tête, qui utilise le partage natif quand il existe).
- L'import est **validé et confirmé** : aperçu du contenu, refus des fichiers invalides, export de sécurité automatique avant remplacement.
- Un écran d'erreur global permet d'exporter ou de réinitialiser les données si une entrée corrompue bloque l'affichage.

## Déploiement Debian (accès distant)

L’app est un site statique : nginx sert les fichiers, **la base reste dans le navigateur** de chaque appareil (IndexedDB). Ce n’est pas une base sur le serveur.

### Recommandé : Docker

Sur le serveur, depuis la racine du projet :

```bash
chmod +x deploy/install-debian.sh
sudo ./deploy/install-debian.sh
```

Ou à la main :

```bash
cp .env.example .env          # DRIVLY_PORT=80 par défaut
sudo docker compose up -d --build
```

- App : `http://IP-DU-SERVEUR/`
- Santé : `http://IP-DU-SERVEUR/health`

Si le port 80 est déjà pris :

```bash
echo 'DRIVLY_PORT=8080' > .env
sudo docker compose up -d --build
```

Puis ouvre le port dans le pare-feu (`ufw allow 80/tcp` ou `8080`).

Mise à jour :

```bash
git pull
sudo docker compose up -d --build
```

### Variante sans Docker (nginx + Node)

```bash
sudo ./deploy/install-debian.sh nginx
```

Les fichiers vont dans `/var/www/drivly`. Config : `deploy/nginx.debian.conf`.

### HTTPS (domaine)

Une fois le DNS pointé vers le serveur :

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d drivly.exemple.fr
```

En Docker, place un reverse-proxy (Caddy / nginx) devant le conteneur, ou mappe 80/443 sur un proxy existant.

Si nginx est **déjà** sur le port 80, lance Drivly sur 8080 puis utilise `deploy/nginx.reverse-proxy.conf` (remplace `server_name`).

## PWA (installer sur l’écran d’accueil)

L’app s’installe comme une application (Chrome / Edge / Safari iOS).

- En local : `npm run build && npm run preview`, puis « Installer » dans le navigateur (`http://127.0.0.1:4173`).
- À distance : **HTTPS est obligatoire** (Certbot). HTTP sur une IP ne propose pas l’installation.
- Sur iPhone : Partager → Sur l’écran d’accueil.
- Écran **Plus** : bouton « Installer l'application » quand le navigateur le propose.

## Export / import

Écran **Plus** : export JSON complet. Utile pour sauvegarder ou passer d’un téléphone à un ordinateur (les données ne sont pas sur le Debian).
