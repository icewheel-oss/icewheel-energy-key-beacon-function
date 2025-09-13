# Icewheel Energy Key Beacon — Cloud Run Deployment

This project provides a minimal, single-file, self-contained web application designed to help you manage your Tesla Fleet API integration. It serves two main purposes:

1.  **Hosts Your Public Key**: It serves your public key at the required URL for Tesla to validate your domain.
    - `GET /.well-known/appspecific/com.tesla.3p.public-key.pem` → Serves your configured public key (PEM).
2.  **Provides a User Interface**: It offers a simple web page to generate a partner token, register your domain, and verify the setup, with all API calls happening securely on the server side.

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
    - Click **Create Service**.

2.  **Configure the Service**:
    - Select **Deploy new revision from source code**.
    - Click **Use online editor** to open the code editor directly in your browser.

3.  **Add the Code**:
    - **`index.js`**: Copy the entire content of the `index.js` file from this project and paste it into the `index.js` file in the editor.
    - **`package.json`**: Click the **`+`** icon to add a new file. Name it `package.json`. Copy the content of this project's `package.json` file and paste it into the new file you just created.

4.  **Set the Entry Point (Important)**:
    - In the **Build settings** section, find the **Entry point** field.
    - Enter `beacon`. This tells Cloud Run which function in your code to execute when a request comes in.

5.  **Set Service Details**:
    - Give your service a **Service name** (e.g., `icewheel-energy-beacon`).
    - Choose a **Region** close to you.

6.  **Allow Public Access**:
    - Under **Authentication**, select **Allow unauthenticated invocations**. This makes your web app public so you can access it.

7.  **Configure Environment Variable (Your Public Key)**:
    - Expand the **Container, Networking, Security** section.
    - Go to the **Variables & Secrets** tab.
    - Under **Environment variables**, click **Add Variable**.
    - Set the **Name** to `TESLA_PUBLIC_KEY`.
    - Set the **Value** to your full public key content (including the `-----BEGIN...` and `-----END...` lines).

8.  **Optimize for Cost (Important)**:
    - Go to the **Container** tab.
    - Under **Auto-scaling**, set the **Minimum number of instances** to **`0`**. This is the key to saving money, as it allows your app to "sleep" and not incur costs when idle.
    - Set the **Maximum number of instances** to **`1`**. This acts as a safety measure to prevent your app from scaling up and causing unexpected costs.

9.  **Deploy**:
    - Click **Deploy** and wait for the process to complete. You can now access your service at the URL provided!

### Option 2: Deploy via the Command Line (`gcloud`)

If you have the `gcloud` command-line tool installed, you can deploy the service with a single command. Run this from the `cloud-function` directory. The entry point is handled automatically by the `start` script in `package.json` when using this method.

```sh
# Make sure to replace YOUR_PUBLIC_KEY with your actual PEM key content
gcloud run deploy icewheel-energy-beacon \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="TESLA_PUBLIC_KEY=YOUR_PUBLIC_KEY" \
  --min-instances=0 \
  --max-instances=1
```

**What this command does:**
- `gcloud run deploy`: Tells Google to deploy a Cloud Run service.
- `--source .`: Uploads the code from your current directory.
- `--allow-unauthenticated`: Makes the web app publicly accessible.
- `--set-env-vars`: Sets your Tesla public key as an environment variable.
- `--min-instances=0`: Sets the service to scale to zero to save costs.
- `--max-instances=1`: Prevents the service from scaling beyond one instance, acting as a cost-control measure.

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
