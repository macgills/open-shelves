const tokenKey = 'open-shelves-hf-token';
const metadataDataset = 'institutional/institutional-books-1.0-metadata';
const datasetsApi = 'https://datasets-server.huggingface.co';
const missingClientId = 'missing-hf-oauth-client-id';

const clientId = document.querySelector('meta[name="hf-oauth-client-id"]')?.content?.trim() ?? '';
const oauthConfigured = Boolean(clientId && clientId !== missingClientId);
const signIn = document.querySelector('#hf-sign-in');
const termsConfirmed = document.querySelector('#terms-confirmed');
const tokenAccess = document.querySelector('#token-access');
const tokenAccessSummary = tokenAccess?.querySelector('summary');
const tokenForm = document.querySelector('#hf-token-form');
const tokenInput = document.querySelector('#hf-access-token');
const tokenSubmit = document.querySelector('#hf-token-submit');
const tokenStatus = document.querySelector('#hf-token-status');

const updateTokenUi = () => {
  const accepted = Boolean(termsConfirmed?.checked);
  if (tokenInput) tokenInput.disabled = !accepted;
  if (tokenSubmit) tokenSubmit.disabled = !accepted;
};

if (!oauthConfigured) {
  if (signIn) signIn.hidden = true;
  if (tokenAccess) tokenAccess.open = true;
  if (tokenAccessSummary) tokenAccessSummary.textContent = 'Connect with a Hugging Face access token';
} else if (tokenAccessSummary) {
  tokenAccessSummary.textContent = 'Use an access token instead';
}

signIn?.addEventListener('click', event => {
  if (oauthConfigured) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (tokenAccess) tokenAccess.open = true;
  tokenInput?.focus();
}, { capture: true });

termsConfirmed?.addEventListener('change', updateTokenUi);
updateTokenUi();

tokenForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!termsConfirmed?.checked) {
    tokenStatus.textContent = 'Review and accept the dataset terms first.';
    return;
  }

  const accessToken = tokenInput?.value?.trim() ?? '';
  if (!accessToken) {
    tokenStatus.textContent = 'Paste a Hugging Face read token.';
    tokenInput?.focus();
    return;
  }

  tokenSubmit.disabled = true;
  tokenStatus.textContent = 'Checking access…';
  try {
    const url = new URL(`${datasetsApi}/splits`);
    url.searchParams.set('dataset', metadataDataset);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || (response.status === 401 || response.status === 403
        ? 'That token does not have access to the collection.'
        : `Hugging Face returned HTTP ${response.status}.`));
    }

    sessionStorage.setItem(tokenKey, accessToken);
    tokenInput.value = '';
    tokenStatus.textContent = 'Connected. Opening the shelves…';
    location.reload();
  } catch (error) {
    tokenStatus.textContent = error.message;
    tokenSubmit.disabled = false;
  }
});
