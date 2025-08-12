export const env = {
  devMockMode:
    process.env.DEV_MOCK_MODE === '1' ||
    (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production' && process.env.DEV_MOCK_MODE !== '0'),
};


