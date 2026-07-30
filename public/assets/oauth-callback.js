const basePath = '/open-shelves';
const tokenKey = 'open-shelves-hf-token';
const status = document.querySelector('#oauth-status');

const fail = message => {
  status.textContent = message;
  const link = document.createElement('a');
  link.href = `${basePath}/`;
  link.textContent = 'Return to Open Shelves';
  status.after(link);
};

try {
  const params = new URL(location.href).searchParams;
  const error = params.get('error');
  if (error) throw new Error(params.get('error_description') || error);

  const code = params.get('code');
  const returnedState = params.get('state');
  const expectedState = sessionStorage.getItem('open-shelves-oauth-state');
  const verifier = sessionStorage.getItem('open-shelves-pkce-verifier');
  if (!code || !returnedState || !expectedState || returnedState !== expectedState || !verifier) {
    throw new Error('The sign-in response could not be verified. Start again from Open Shelves.');
  }

  const clientId = `${location.origin}${basePath}/.well-known/oauth-cimd`;
  const redirectUri = `${location.origin}${basePath}/oauth/callback/huggingface/`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: verifier
  });

  const response = await fetch('https://huggingface.co/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || 'Hugging Face did not return an access token.');

  sessionStorage.setItem(tokenKey, payload.access_token);
  sessionStorage.removeItem('open-shelves-oauth-state');
  sessionStorage.removeItem('open-shelves-pkce-verifier');
  const destination = sessionStorage.getItem('open-shelves-return-to') || `${basePath}/`;
  sessionStorage.removeItem('open-shelves-return-to');
  location.replace(destination);
} catch (error) {
  fail(error.message);
}
