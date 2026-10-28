const config = {
  poweredByHeader: false,
  serverExternalPackages: ['sharp', 'file-type'],
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Permissions-Policy',value:'camera=(self), microphone=(), geolocation=()'}
    ]}];
  }
};
export default config;
