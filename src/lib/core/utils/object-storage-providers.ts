export interface ObjectStorageProvider {
  id: string
  name: string
  endpointPattern: string
  regionLabel: string
  regionPlaceholder: string
}

export const PROVIDERS: ObjectStorageProvider[] = [
  {
    id: 's3',
    name: 'AWS S3',
    endpointPattern: 'https://s3.{region}.amazonaws.com',
    regionLabel: 'Region',
    regionPlaceholder: 'us-east-1, eu-west-1, etc.',
  },
  {
    id: 'backblaze',
    name: 'Backblaze B2',
    endpointPattern: 'https://s3.{region}.backblazeb2.com',
    regionLabel: 'Region',
    regionPlaceholder: 'us-west-001, eu-central-003, etc.',
  },
  {
    id: 'cloudflare',
    name: 'CloudFlare R2',
    endpointPattern: 'https://{region}.r2.cloudflarestorage.com',
    regionLabel: 'Account ID',
    regionPlaceholder: 'Your account ID',
  },
  {
    id: 'digitalocean',
    name: 'Digital Ocean Spaces',
    endpointPattern: 'https://s3.{region}.digitaloceanspaces.com',
    regionLabel: 'Region',
    regionPlaceholder: 'nyc3, sfo3, ams3, etc.',
  },
  {
    id: 'ibmcloud',
    name: 'IBM Cloud',
    endpointPattern: 'https://s3.{region}.cloud-object-storage.appdomain.cloud',
    regionLabel: 'Region',
    regionPlaceholder: 'us-south, eu-gb, etc.',
  },
  {
    id: 'impossiblecloud',
    name: 'Impossible Cloud',
    endpointPattern: 'https://{region}.storage.impossibleapi.net',
    regionLabel: 'Account ID',
    regionPlaceholder: 'Your account ID',
  },
  {
    id: 'lyve',
    name: 'Lyve (Seagate)',
    endpointPattern: 'https://s3.{region}.lyvecloud.seagate.com',
    regionLabel: 'Region',
    regionPlaceholder: 'us-east-1, ap-southeast-1, etc.',
  },
  {
    id: 'wasabi',
    name: 'Wasabi',
    endpointPattern: 'https://s3.{region}.wasabisys.com',
    regionLabel: 'Region',
    regionPlaceholder: 'us-east-1, us-west-1, etc.',
  },
  {
    id: 's3compatible',
    name: 'S3 Compatible',
    endpointPattern: '',
    regionLabel: 'Region',
    regionPlaceholder: 'Enter region',
  },
]

export const PROVIDER_OPTIONS = PROVIDERS.map(p => ({ value: p.id, label: p.name }))

export function getProvider(id: string): ObjectStorageProvider | undefined {
  return PROVIDERS.find(p => p.id === id)
}

export function generateEndpoint(providerId: string, region: string): string {
  const provider = PROVIDERS.find(p => p.id === providerId)
  if (!provider?.endpointPattern || !region) return ''
  return provider.endpointPattern.replace('{region}', region)
}

export function isCustomEndpoint(providerId: string): boolean {
  return providerId === 's3compatible'
}
