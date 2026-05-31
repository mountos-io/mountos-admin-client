export interface ObjectStorageProvider {
  id: string
  name: string
  endpointPattern: string
  regionLabel: string
  regionPlaceholder: string
  // Per-provider field-label overrides. Azure uses different terminology
  // (container vs bucket, account name vs access key, account key vs secret key)
  // the form picks these up to keep the UI accurate without renaming the
  // underlying storage payload fields.
  bucketLabel?: string
  bucketPlaceholder?: string
  accessKeyLabel?: string
  accessKeyPlaceholder?: string
  secretKeyLabel?: string
  secretKeyPlaceholder?: string
  // When true, the form treats the `region` input as the value to substitute
  // into the endpoint pattern AND mirrors it into the `accessKey` field
  // (Azure's storage account name is both the URL host prefix AND the auth
  // identity, so users would otherwise have to type it twice).
  regionDrivesAccessKey?: boolean
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
  {
    id: 'azure',
    name: 'Azure Blob Storage',
    endpointPattern: 'https://{region}.blob.core.windows.net',
    regionLabel: 'Storage Account',
    regionPlaceholder: 'mystorageaccount',
    bucketLabel: 'Container',
    bucketPlaceholder: 'my-container',
    accessKeyLabel: 'Storage Account Name',
    accessKeyPlaceholder: 'auto-filled from Storage Account',
    secretKeyLabel: 'Account Key',
    secretKeyPlaceholder: 'base64-encoded account key',
    regionDrivesAccessKey: true,
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

export function isAzureProvider(providerId: string): boolean {
  return providerId === 'azure'
}
