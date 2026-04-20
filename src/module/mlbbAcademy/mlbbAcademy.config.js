let cachedClient;

const getMlbbClient = async () => {
  if (cachedClient) {
    return cachedClient;
  }

  // Keep project CommonJS while loading ESM-only mlbb-sdk.
  const { createMlbbClient } = await import("mlbb-sdk");
  cachedClient = createMlbbClient({
    lang: "en",
    timeout: 30000,
    retries: 2,
  });
  return cachedClient;
};

module.exports = {
  getMlbbClient,
};