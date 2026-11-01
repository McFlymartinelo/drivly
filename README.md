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

## Sauvegarde serveur (optionnelle)

En plus de l'export JSON, Drivly peut envoyer une copie versionnée sur le serveur Debian. C'est un service `api` (Node + SQLite) ajouté au `compose.yaml` : la base est dans le volume Docker `drivly-data`, l'app reste local-first et fonctionne hors ligne.

### Mise en place

```bash
# 1. Jeton serveur (une seule fois)
TOKEN=$(openssl rand -hex 32)
grep -q '^DRIVLY_TOKEN=' .env \
  && sed -i "s/^DRIVLY_TOKEN=.*/DRIVLY_TOKEN=${TOKEN}/" .env \
  || echo "DRIVLY_TOKEN=${TOKEN}" >> .env

# 2. Secret des comptes (32+ caractères)
SECRET=$(openssl rand -hex 32)
grep -q '^AUTH_SECRET=' .env \
  && sed -i "s/^AUTH_SECRET=.*/AUTH_SECRET=${SECRET}/" .env \
  || echo "AUTH_SECRET=${SECRET}" >> .env

# 3. (Re)lancer
sudo docker compose up -d --build
echo "Jeton serveur : $TOKEN"
```

Puis dans l'app : **Plus → Sauvegarde serveur → Configurer**. Deux modes :

- **Compte** (recommandé) : email + mot de passe. Pour le premier compte, ajoute
  la **clé serveur** (`DRIVLY_TOKEN`) : elle autorise la création de comptes.
  Les connexions suivantes n'utilisent que l'email et le mot de passe.
- **Jeton** : l'ancien mode, colle directement `DRIVLY_TOKEN`.

La sauvegarde automatique s'active ensuite : **chaque entrée ajoutée, modifiée
ou supprimée est écrite dans les tables SQL du serveur en moins d'une seconde**
(et quand l'app passe en arrière-plan).

> Les comptes sont **optionnels et côté serveur uniquement** : sans
> `AUTH_SECRET`, le serveur reste en mode jeton. L'app continue de fonctionner
> hors ligne, sans compte.
>
> Les sauvegardes sont partagées entre les comptes d'un même serveur (usage
> familial). Il n'y a pas de réinitialisation de mot de passe par email : le
> serveur n'a pas de SMTP. Un mot de passe oublié se règle côté base (voir
> `src/aura/auth/README.md`).

Côté serveur, chaque type d'entrée a sa table (`vehicles`, `refuelings`, `expenses`, `maintenances`, `reminders`, `readings`, `trips`, `checklists`) avec les colonnes utiles (`vehicle_id`, `date`, `kilometrage`, `montant`…) **et** le JSON complet dans `data`. Une version de sauvegarde est créée à chaque changement (dédupliquée par empreinte SHA-256).

- **Restaurer** : Plus → Sauvegarde serveur → Restaurer, choisis une version. Un export local est téléchargé avant remplacement.
- **Versionnage** : `DRIVLY_MAX_SNAPSHOTS` (50 par défaut).
- **API** (protégée par une session de compte **ou** `Authorization: Bearer <DRIVLY_TOKEN>`) :
  - `GET /api/health` (public, indique si les comptes sont activés)
  - `POST /api/auth/register` (`email`, `password`, `code` = `DRIVLY_TOKEN`)
  - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
  - `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `POST /api/push/test`
  - `POST /api/notifications/schedule`
  - `POST /api/backups` (payload complet, met à jour les tables)
  - `GET /api/backups`, `GET /api/backups/latest`, `GET /api/backups/:id`
  - `GET /api/entries/refuelings?limit=100&offset=0` (idem pour chaque table)
  - `GET /api/stats` (compteurs par table + nombre de versions)

### Notifications (push)

Deux canaux, calculés depuis les données locales :

- **Rappels d'entretien** : 7 jours avant l'échéance (date ou kilométrage
  estimé à partir de la vitesse moyenne).
- **Prochain plein** : 3 jours avant la date estimée (intervalle moyen entre
  pleins + autonomie restante).

L'app calcule le calendrier et l'envoie au serveur
(`POST /api/notifications/schedule`) : le serveur ne lit pas les données
métier, il stocke et envoie à l'heure. Le push nécessite un compte serveur.

Mise en place :

```bash
# 1. Clés VAPID (une seule fois)
npx web-push generate-vapid-keys

# 2. Les ajouter dans .env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:toi@exemple.fr

# 3. Rebuild
sudo docker compose up -d --build
```

Puis dans l'app : **Plus → Notifications → Activer**.

- **Android** : permission du navigateur, puis abonnement.
- **iPhone** : installer d'abord la PWA (**Partager → Sur l'écran d'accueil**),
  puis activer depuis l'icône. Safari dans un onglet ne reçoit pas de push
  (iOS 16.4+).

Le style se règle au même endroit : **Auto** (Instrument sur Android, Bandeau
sur iPhone), **Instrument**, **Bandeau** ou **Carte**. Le bouton **Tester**
affiche le style in-app et envoie un push.

> Le push ne se teste pas dans le serveur de dev : le service worker de dev
> n'inclut pas `push-sw.js`. Utiliser un build de production ou l'app installée.

### Peupler la base depuis un fichier

```bash
docker compose cp ~/drivly-export-2026-10-30.json api:/tmp/export.json
docker compose exec -T api node server/import.mjs /tmp/export.json
```

L'import remplace le contenu des tables et crée une version marquée « import CLI ». Il peut tourner pendant que l'API est active.


### Sauvegarder la base SQLite elle-même

Le volume survit aux mises à jour de l'image, mais pas à une suppression du volume. Copie régulière conseillée :

```bash
sudo docker run --rm \
  -v drivly_drivly-data:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/drivly-data-$(date +%F).tgz -C /data .
```

⚠️ Utilise **HTTPS** (Certbot) : le jeton circule dans l'en-tête `Authorization`. En HTTP simple, il est visible sur le réseau.

### Variante sans Docker

Lance l'API avec Node 24 (aucune dépendance) et un service systemd, puis nginx proxifie `/api/` vers `127.0.0.1:3000` (déjà configuré dans `deploy/nginx.debian.conf`) :

```bash
sudo useradd --system --home /var/lib/drivly drivly
sudo mkdir -p /var/lib/drivly && sudo chown drivly: /var/lib/drivly
sudo install -m 0644 deploy/drivly-api.service /etc/systemd/system/
sudo install -d /opt/drivly && sudo cp -r server /opt/drivly/
sudo tee /etc/drivly-api.env >/dev/null <<EOF
DRIVLY_TOKEN=$(openssl rand -hex 32)
DRIVLY_DB=/var/lib/drivly/drivly.sqlite
EOF
sudo systemctl enable --now drivly-api
sudo cat /etc/drivly-api.env
```

## Reconstituer des pleins depuis une carte carburant

Un relevé de carte (TotalEnergies, etc.) donne les dates, litres, prix, montants et stations, mais pas le kilométrage. Le script ancre le dernier compteur connu puis répartit la distance au prorata des litres :

```bash
node scripts/rebuild-from-card.mjs \
  --card ~/Downloads/releve-total.csv \
  --km-now 195000 \
  --plate CJ-653-HM
```

- `--km-now` : compteur actuel du véhicule. La distance totale devient exacte ; les kilomètres intermédiaires restent estimés. Sans cette option, la distance est estimée avec la consommation historique (affichée dans le résumé).
- `--plate` : filtre les lignes d'un autre véhicule si le relevé contient une colonne véhicule.
- Les colonnes sont détectées automatiquement (date, litres/volume, montant, prix/L, station, produit, compteur). Un compteur présent dans le relevé est utilisé tel quel.
- Les lignes non-carburant (lavage, accessoires) deviennent des dépenses.
- Les pleins reconstruits sont marqués dans leurs notes.

Le script produit un JSON complet (historique existant + nouveaux pleins) à importer dans l'app, ou à charger directement sur le serveur :

```bash
docker compose cp drivly-reconstruit.json api:/tmp/reconstruit.json
docker compose exec -T api node server/import.mjs /tmp/reconstruit.json
```

Puis **Plus → Sauvegarde serveur → Restaurer** sur le téléphone.

⚠️ Les kilométrages sont des estimations : la consommation de la période sera lissée. Les dates, litres, prix et montants, eux, sont exacts.

### Nettoyer les consommations aberrantes

L'app ignore désormais les consommations hors **2–15 L/100km** (affichées « — » et exclues des moyennes, min/max et graphiques). Pour corriger aussi les données, le script repère les pleins partiels enregistrés comme complets et les repasse en partiels :

```bash
node scripts/sanitize-fills.mjs \
  --file drivly-merged.json \
  --out drivly-merged-clean.json
```

Il liste les pleins modifiés et les anomalies restantes (relevés manquants), puis produit une sauvegarde prête à réimporter.




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
