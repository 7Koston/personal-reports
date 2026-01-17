#!/usr/bin/env node

import axios from 'axios';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parse } from 'node:url';
import open from 'open';
import type { GoogleTokenResponse } from '../src/global/types.js';

const PORT = 8080;
const SCOPES = ['https://www.googleapis.com/auth/calendar.events.readonly'];
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function getRefreshToken(): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (
    clientId == null ||
    clientId === '' ||
    clientSecret == null ||
    clientSecret === ''
  ) {
    console.error(
      'Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env file',
    );
    process.exit(1);
  }

  // Generate the authorization URL
  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'select_account consent',
  });
  const authorizeUrl = `${AUTH_URL}?${authParams.toString()}`;

  console.log('\nGoogle OAuth2 Token Generator\n');
  console.log(
    'This script will help you generate a refresh token for Google Calendar API.\n',
  );
  console.log('Steps:');
  console.log('1. A browser window will open for authorization');
  console.log('2. Sign in with your Google account');
  console.log('3. Grant the requested permissions');
  console.log('4. The refresh token will be saved automatically\n');

  // Create a local server to handle the OAuth callback
  const server = http.createServer((req, res) => {
    if (req.url == null || req.url === '') {
      return;
    }

    const queryData = parse(req.url, true).query;

    if (typeof queryData.code === 'string' && queryData.code !== '') {
      const code = queryData.code;

      // Send success response to browser
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
				<!DOCTYPE html>
				<html>
					<head>
						<title>Authorization Successful</title>
						<style>
							body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
							.success { color: #4CAF50; font-size: 24px; }
							.message { margin-top: 20px; color: #666; }
						</style>
					</head>
					<body>
						<div class="success">Authorization Successful!</div>
						<div class="message">You can close this window and return to the terminal.</div>
					</body>
				</html>
			`);

      // Exchange authorization code for tokens
      void (async (): Promise<void> => {
        try {
          const tokenResponse = await axios.post<GoogleTokenResponse>(
            TOKEN_URL,
            new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: REDIRECT_URI,
              grant_type: 'authorization_code',
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            },
          );

          const tokens = tokenResponse.data;

          if (tokens.refresh_token == null || tokens.refresh_token === '') {
            console.error('\n❌ Error: No refresh token received.');
            console.log(
              'This might happen if you have already authorized this app.',
            );
            console.log(
              'Try revoking access at: https://myaccount.google.com/permissions',
            );
            console.log('Then run this script again.\n');
            process.exit(1);
          }

          console.log('\nSuccess! Tokens received.\n');
          console.log('Refresh Token:', tokens.refresh_token);
          console.log('Access Token:', tokens.access_token);
          console.log('Expires In:', tokens.expires_in, 'seconds\n');

          // Save refresh token to file
          const tokenFilePath = path.join(process.cwd(), 'refresh_token');
          fs.writeFileSync(tokenFilePath, tokens.refresh_token, 'utf8');
          console.log(`Refresh token saved to: ${tokenFilePath}\n`);

          // Update .env file suggestion
          console.log('To use this token, update your .env file with:');
          console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

          server.close();
          process.exit(0);
        } catch (error) {
          console.error('\nError exchanging authorization code:', error);
          server.close();
          process.exit(1);
        }
      })();
    } else if (typeof queryData.error === 'string' && queryData.error !== '') {
      // Handle authorization error
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
				<!DOCTYPE html>
				<html>
					<head>
						<title>Authorization Failed</title>
						<style>
							body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
							.error { color: #f44336; font-size: 24px; }
							.message { margin-top: 20px; color: #666; }
						</style>
					</head>
					<body>
						<div class="error">Authorization Failed</div>
						<div class="message">Error: ${queryData.error}</div>
						<div class="message">You can close this window and return to the terminal.</div>
					</body>
				</html>
			`);

      console.error(`\n❌ Authorization failed: ${queryData.error}\n`);
      server.close();
      process.exit(1);
    }
  });

  // Start the local server
  server.listen(PORT, () => {
    console.log(`🌐 Local server started on http://localhost:${PORT}`);
    console.log('📱 Opening browser for authorization...\n');

    // Open the authorization URL in the default browser
    try {
      void open(authorizeUrl);
    } catch {
      console.log('Could not open browser automatically.');
      console.log('Please open this URL manually:\n');
      console.log(authorizeUrl);
      console.log();
    }
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('\n❌ Server error:', error);
    console.log(`Make sure port ${PORT} is not already in use.\n`);
    process.exit(1);
  });
}

// Run the script
getRefreshToken();
