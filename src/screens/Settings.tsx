import { Database, Info, RotateCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Badge, Button, Card, Heading, Row, Stack, Text } from '@/components/ui'
import { cn } from '@/lib/cn'
import { getConfig } from '@/lib/config'
import { hardReload } from '@/lib/pwa'

/**
 * Settings.
 *
 * Deliberately thin: the hub is configured by the deployed `config.json`, not by
 * a human tapping around, so there are no live preferences to store yet. What it
 * does carry is the stuff you actually need standing in front of a wall-mounted
 * display — which data source it's on, and exactly which build is running, so a
 * stale service-worker cache can never leave you guessing.
 */
export function Settings() {
  const config = getConfig()
  const [reloading, setReloading] = useState(false)

  function reload() {
    setReloading(true)
    void hardReload()
  }

  return (
    <Stack gap="lg" className="h-full">
      <Heading role="hero" level={1}>
        Settings
      </Heading>

      <Stack gap="lg" className="min-h-0 max-w-3xl flex-1 overflow-y-auto">
        <Card pad="lg">
          <Stack gap="md">
            <Row gap="sm">
              <Database className="h-5 w-5 text-ember" />
              <Heading role="section">Data source</Heading>
            </Row>
            <SettingRow label="Mode">
              <Badge tone={config.useMockData ? 'clay' : 'sage'}>
                {config.useMockData ? 'Mock data' : 'Live'}
              </Badge>
            </SettingRow>
            {!config.useMockData && config.windmillBaseUrl ? (
              <SettingRow label="Endpoint">
                <Text size="sm" tone="dim" className="truncate font-mono">
                  {config.windmillBaseUrl}
                </Text>
              </SettingRow>
            ) : null}
          </Stack>
        </Card>

        <Card pad="lg">
          <Stack gap="md">
            <Row gap="sm">
              <Info className="h-5 w-5 text-sage" />
              <Heading role="section">About</Heading>
            </Row>
            <SettingRow label="Version">
              <Text size="sm" tone="dim" className="font-mono">
                v{__APP_VERSION__}
              </Text>
            </SettingRow>
            <SettingRow label="Revision">
              <Text size="sm" tone="dim" className="font-mono">
                {__BUILD_REV__}
              </Text>
            </SettingRow>
            <SettingRow label="Built">
              <Text size="sm" tone="dim">
                {formatBuildTime(__BUILD_TIME__)}
              </Text>
            </SettingRow>
          </Stack>
        </Card>

        <Button
          variant="secondary"
          size="lg"
          className="self-start"
          disabled={reloading}
          onClick={reload}
        >
          <RotateCw className={cn('h-5 w-5', reloading && 'animate-spin')} />
          {reloading ? 'Reloading…' : 'Reload app'}
        </Button>

        <Text size="xs" tone="faint" className="max-w-md">
          Clears the offline cache and fetches the newest build from the network.
        </Text>
      </Stack>
    </Stack>
  )
}

/** Label on the left, value on the right — the one row shape this screen uses. */
function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row justify="between" gap="md" className="min-h-touch border-t border-line pt-3">
      <Text tone="faint">{label}</Text>
      <div className="min-w-0 text-right">{children}</div>
    </Row>
  )
}

/** ISO build stamp → a readable local date-time. Absolute, not relative: the
 *  point is to pin the exact build, not to say "2 hours ago". */
function formatBuildTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
