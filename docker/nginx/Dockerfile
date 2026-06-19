FROM nginx:stable-alpine

# Remove default configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy global configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy template configuration (will be processed by envsubst at startup)
COPY conf.d/app.conf.template /etc/nginx/templates/app.conf.template

# The official NGINX image includes a script that automatically runs envsubst on templates
# located in /etc/nginx/templates/*.template and outputs them to /etc/nginx/conf.d/*.conf
# as long as the NGINX_ENVSUBST_OUTPUT_DIR environment variable is not changed.

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
