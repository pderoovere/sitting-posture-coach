# Setup

Setup a PostgreSQL database and S3 bucket and update [training .env](/training/.env) and [app .env](/sitting-posture-coach/.env) files.

Use the [init script](/setup/init.sql) to initialize the table holding the training examples.

Setup node.js and run `npm install` in the `/sitting-posture-coach` directory to install the node dependencies. Run `node index.js` to start the app.
