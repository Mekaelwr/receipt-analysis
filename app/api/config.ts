// API runtime configuration
export const apiConfig = {
  // Routes that should use Node.js runtime
  nodeRoutes: [
    'upload-receipt',
    'analyze-receipt',
    'create-suggestion-model',
    'standardize-items',
  ],
  
  // Routes that can use Edge runtime
  edgeRoutes: [
    'store-price-comparison',
    'temporal-price-comparison',
    'cheaper-alternatives',
    'price-comparison',
    'receipt',
    'user',
  ],
  
  // Default configuration for Node.js routes
  nodeConfig: {
    api: {
      bodyParser: {
        sizeLimit: '10mb',
      },
      responseLimit: '10mb',
    },
  },
  
  // Default configuration for Edge routes
  edgeConfig: {
    regions: ['iad1', 'sfo1'], // Example Cloudflare regions
    cache: 'manual',
  }
}; 