# Production deployment

The repository includes a Render Blueprint for the API and static PWA. Before deployment:

1. Rotate the MongoDB database password that was used during development.
2. Create a least-privilege production database user.
3. Configure Atlas network access and automated backups.
4. Set `MONGODB_URI`, `WEB_ORIGIN`, and `VITE_API_URL` in the hosting dashboard.
5. Use the generated production `JWT_SECRET`; never reuse the development secret.
6. Connect the custom domain after both services are healthy.
7. Test Android, iOS and Windows PWA installation.
8. Validate GST configuration and invoice wording with the business accountant.

`render.yaml` intentionally contains no credentials.
