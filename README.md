npm run build
sudo cp -r dist/* /var/www/videoanalyzer/
sudo systemctl reload nginx



sudo nginx -t
sudo nano /etc/nginx/nginx.conf
sudo nano /etc/nginx/sites-available/videoanalyzer