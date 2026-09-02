# Drivly

Suivi de véhicules, local-first (IndexedDB). PWA-ready.

```bash
npm install
npm run dev
```

Ouvre [http://127.0.0.1:5173](http://127.0.0.1:5173).

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

## Export / import

Écran **Plus** : export JSON complet. Utile pour sauvegarder ou passer d’un téléphone à un ordinateur (les données ne sont pas sur le Debian).
