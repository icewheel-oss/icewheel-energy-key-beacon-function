# Icewheel Energy Key Beacon — Cloud Run Deployment

This project provides a minimal, single-file, self-contained web application designed to help you manage your Tesla Fleet API integration. It serves two main purposes:

1.  **Hosts Your Public Key**: It serves your public key at the required URL for Tesla to validate your domain.
    - `GET /.well-known/appspecific/com.tesla.3p.public-key.pem` → Serves your configured public key (PEM).
2.  **Provides a User Interface**: It offers a simple web page to generate a partner token, register your domain, and verify the setup, with all API calls happening securely on the server side.

### Demo

A demo deployment for development environment is at [https://beacon-function.icewheel.dev/](https://beacon-function.icewheel.dev/) to try only and then users can do their own deployment

This guide focuses on deploying the application to **Google Cloud Run**, which is the recommended platform.

### Disclaimer

The instructions provided in this guide are for educational purposes and are meant to be a helpful starting point. Cloud provider interfaces and command-line tools change over time. You are encouraged to supplement this guide with official documentation from Google Cloud and other learning resources like video tutorials.

The user is solely responsible for their own setup, including any costs incurred or issues that may arise. We are not liable for any problems or damages resulting from following these instructions.

### Why Google Cloud Run?

- **Free Tier**: Cloud Run has a generous free tier. For this app's usage, it will likely cost you nothing.
- **Automatic HTTPS**: You get a secure, trusted `https://` URL for your service automatically, which is a requirement for the Tesla API.
- **Serverless & Cost-Effective**: The service can "scale to zero," meaning you are not charged when it's not in use. It wakes up instantly when a request comes in.

---

## Deployment to Google Cloud Run

You have two options for deployment. The first is the easiest if you prefer using a user interface.

### Option 1: Deploy via the Google Cloud Console (Easy Method)

This method uses the inline editor in the Google Cloud Console, so you don't need to install any tools.

1.  **Navigate to Cloud Run**:
    - Go to the [Google Cloud Run](https://console.cloud.google.com/run) page in the Google Cloud Console.
    - Click **"Write a function"**.

2.  **Initial Service Configuration**:
    - **Service name**: Choose a name for your service (e.g., `icewheel-energy-beacon`).
    - **Region**: Select a region close to you.
    - **Runtime**: Choose **Node.js 22** (or a suitable version).
    - **Authentication**: Select **"Allow unauthenticated invocations"**.
    - **Billing**: Choose your preferred option.

3.  **Advanced Settings**:
    - **Scaling**: Set **Minimum number of instances** to `0` and **Maximum number of instances** to `1`.
    - **Ingress**: Select **"All"**.
    - **Container**: Set **Memory** to **256MB** (128MB is also fine) and **CPU** to **1**.
    - **Variables & Secrets**: Add an environment variable with the **Name** `TESLA_PUBLIC_KEY` and your public key as the **Value**.

4.  **Create the Service**:
    - Click **"Create"**. This will provision the service and take you to the inline editor.

5.  **Add Code and Deploy**:
    - In the editor, you will see `index.js` and `package.json` files.
    - **`index.js`**: Replace the default content with the content of this project's `index.js` file.
    - **`package.json`**: Replace the default content with the content of this project's `package.json` file.
    - **Entry point**: Set the **Function entry point** to `beacon`.
    - Click **"Save and redeploy"** to deploy your function.

### Option 2: Deploy via the Command Line (`gcloud`)

If you have the `gcloud` command-line tool installed, you can deploy the service with a single command from the project's root directory.

```sh
# Make sure to replace YOUR_SERVICE_NAME, YOUR_REGION, and YOUR_PUBLIC_KEY
gcloud run deploy YOUR_SERVICE_NAME \
  --source . \
  --region YOUR_REGION \
  --runtime nodejs22 \
  --entry-point beacon \
  --allow-unauthenticated \
  --set-env-vars="TESLA_PUBLIC_KEY=YOUR_PUBLIC_KEY" \
  --min-instances=0 \
  --max-instances=1
```

**What this command does:**
- `gcloud run deploy YOUR_SERVICE_NAME`: Deploys a Cloud Run service with the name you provide.
- `--source .`: Uploads the code from your current directory.
- `--region YOUR_REGION`: Specifies the Google Cloud region for the deployment.
- `--runtime nodejs22`: Sets the runtime environment to Node.js 22.
- `--entry-point beacon`: Specifies the name of the function to execute.
- `--allow-unauthenticated`: Makes the web app publicly accessible.
- `--set-env-vars`: Sets your Tesla public key as an environment variable.
- `--min-instances=0`: Sets the service to scale to zero to save costs.
- `--max-instances=1`: Prevents the service from scaling beyond one instance.

---

### Verification

After deploying your service, you can verify that the public key is being served correctly by visiting the following URL in your browser:

`https://YOUR_SERVICE_URL/.well-known/appspecific/com.tesla.3p.public-key.pem`

Replace `YOUR_SERVICE_URL` with the URL of your deployed Cloud Run service. You should see your public key displayed in the browser.

---

### Optional: Custom Domain Mapping

If you own a domain name, you can map it to your Cloud Run service to use a custom URL.

1.  After your service is deployed, navigate to the **"Domain mappings"** section from the left-side menu in the Cloud Run page.
2.  Follow the instructions to add a new domain mapping and verify your domain ownership.

---

## Local Development (Optional)

If you want to run the app on your local machine before deploying:

1.  **Install dependencies**:
    ```sh
    npm install
    ```
2.  **Run the app**:
    ```sh
    npm start
    ```
- The function will be available at `http://localhost:8080`.
