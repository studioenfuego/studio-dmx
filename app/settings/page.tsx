"use client";

import { useState, useEffect, useCallback } from "react";
import { useDMXStore } from "@/lib/store";
import { sendWS, onWSMessage } from "@/lib/wsClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, Play, Square, Wifi, WifiOff, RefreshCw, Usb, Radio } from "lucide-react";

interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

interface SettingsState {
  dmxInterface: "artnet" | "enttec";
  artnetHost: string;
  artnetPort: number;
  artnetNet: number;
  artnetSubnet: number;
  artnetUniverse: number;
  enttecPort: string;
}

// Enttec USB Pro Mk2/Mk3 identifiers
const ENTTEC_VENDOR_ID = "0403"; // FTDI

function isLikelyEnttec(port: SerialPortInfo): boolean {
  return (
    port.vendorId?.toLowerCase() === ENTTEC_VENDOR_ID ||
    port.manufacturer?.toLowerCase().includes("ftdi") ||
    port.manufacturer?.toLowerCase().includes("enttec") ||
    port.path.toLowerCase().includes("usbserial") ||
    port.path.toLowerCase().includes("usbmodem")
  );
}

export default function SettingsPage() {
  const { wsConnected } = useDMXStore();
  const [settings, setSettings] = useState<SettingsState>({
    dmxInterface: "artnet",
    artnetHost: "192.168.1.255",
    artnetPort: 6454,
    artnetNet: 0,
    artnetSubnet: 0,
    artnetUniverse: 0,
    enttecPort: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [engineRunning, setEngineRunning] = useState(false);
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [portsLoading, setPortsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v1/settings")
      .then((r) => r.json())
      .then((s) => {
        setSettings({
          dmxInterface: s.dmxInterface ?? "artnet",
          artnetHost: s.artnetHost ?? "192.168.1.255",
          artnetPort: s.artnetPort ?? 6454,
          artnetNet: s.artnetNet ?? 0,
          artnetSubnet: s.artnetSubnet ?? 0,
          artnetUniverse: s.artnetUniverse ?? 0,
          enttecPort: s.enttecPort ?? "",
        });
      })
      .catch(() => {});

    sendWS({ type: "get_state" });
    const unsub = onWSMessage((msg: Record<string, unknown>) => {
      if (msg.type === "state" || msg.type === "engine_status") {
        const engine = msg.engine as { running?: boolean } | undefined;
        if (engine !== undefined) setEngineRunning(engine.running ?? false);
      }
    });
    return unsub;
  }, []);

  const scanPorts = useCallback(async () => {
    setPortsLoading(true);
    try {
      const res = await fetch("/api/v1/ports");
      if (res.ok) setPorts(await res.json());
    } catch { /* ignore */ }
    setPortsLoading(false);
  }, []);

  // Auto-scan when switching to Enttec mode
  useEffect(() => {
    if (settings.dmxInterface === "enttec" && ports.length === 0) {
      scanPorts();
    }
  }, [settings.dmxInterface, ports.length, scanPorts]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    await fetch("/api/v1/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        enttecPort: settings.enttecPort || null,
      }),
    });
    setIsSaving(false);
  }, [settings]);

  const startEngine = () => {
    if (settings.dmxInterface === "enttec") {
      sendWS({ type: "engine_start", config: { outputMode: "enttec", enttecPort: settings.enttecPort } });
    } else {
      sendWS({
        type: "engine_start",
        config: {
          outputMode: "artnet",
          host: settings.artnetHost,
          port: settings.artnetPort,
          net: settings.artnetNet,
          subnet: settings.artnetSubnet,
          universe: settings.artnetUniverse,
        },
      });
    }
  };

  const stopEngine = () => {
    sendWS({ type: "engine_stop" });
    setEngineRunning(false);
  };

  const enttecPorts = ports.filter(isLikelyEnttec);
  const otherPorts = ports.filter((p) => !isLikelyEnttec(p));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-base font-semibold">Settings</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">

          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">DMX Output</h2>
              <Badge variant={wsConnected ? "default" : "destructive"} className="text-xs gap-1">
                {wsConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
                {wsConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>

            {/* Output mode toggle */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Output Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSettings((s) => ({ ...s, dmxInterface: "artnet" }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    settings.dmxInterface === "artnet"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Radio size={14} />
                  Art-Net (Network)
                </button>
                <button
                  onClick={() => setSettings((s) => ({ ...s, dmxInterface: "enttec" }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    settings.dmxInterface === "enttec"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Usb size={14} />
                  USB DMX (Enttec)
                </button>
              </div>
            </div>

            {/* Art-Net settings */}
            {settings.dmxInterface === "artnet" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Art-Net Host / IP</label>
                  <Input
                    value={settings.artnetHost}
                    onChange={(e) => setSettings((s) => ({ ...s, artnetHost: e.target.value }))}
                    className="h-8 text-sm font-mono"
                    placeholder="192.168.1.255"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use broadcast (x.x.x.255) or device IP
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Port</label>
                  <Input
                    type="number"
                    value={settings.artnetPort}
                    onChange={(e) => setSettings((s) => ({ ...s, artnetPort: parseInt(e.target.value) || 6454 }))}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Net</label>
                  <Input
                    type="number"
                    min={0}
                    max={127}
                    value={settings.artnetNet}
                    onChange={(e) => setSettings((s) => ({ ...s, artnetNet: parseInt(e.target.value) || 0 }))}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Subnet</label>
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    value={settings.artnetSubnet}
                    onChange={(e) => setSettings((s) => ({ ...s, artnetSubnet: parseInt(e.target.value) || 0 }))}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Universe</label>
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    value={settings.artnetUniverse}
                    onChange={(e) => setSettings((s) => ({ ...s, artnetUniverse: parseInt(e.target.value) || 0 }))}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>
            )}

            {/* Enttec settings */}
            {settings.dmxInterface === "enttec" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground flex-1">Serial Port</label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs gap-1"
                    onClick={scanPorts}
                    disabled={portsLoading}
                  >
                    <RefreshCw size={10} className={portsLoading ? "animate-spin" : ""} />
                    Scan
                  </Button>
                </div>

                {ports.length === 0 && !portsLoading && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">No serial ports found.</p>
                    <p>Make sure the Enttec is plugged in via USB, then click Scan.</p>
                    <p>On macOS you may need to allow the driver in System Settings → Privacy &amp; Security.</p>
                  </div>
                )}

                {ports.length > 0 && (
                  <div className="space-y-1">
                    {enttecPorts.length > 0 && (
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Likely Enttec</p>
                    )}
                    {enttecPorts.map((p) => (
                      <button
                        key={p.path}
                        onClick={() => setSettings((s) => ({ ...s, enttecPort: p.path }))}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors ${
                          settings.enttecPort === p.path
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-accent"
                        }`}
                      >
                        <Usb size={12} className="shrink-0" />
                        <span className="font-mono flex-1">{p.path}</span>
                        {p.manufacturer && (
                          <span className="text-[10px] opacity-70">{p.manufacturer}</span>
                        )}
                      </button>
                    ))}

                    {otherPorts.length > 0 && (
                      <>
                        {enttecPorts.length > 0 && (
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider pt-1">Other ports</p>
                        )}
                        {otherPorts.map((p) => (
                          <button
                            key={p.path}
                            onClick={() => setSettings((s) => ({ ...s, enttecPort: p.path }))}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors ${
                              settings.enttecPort === p.path
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:bg-accent text-muted-foreground"
                            }`}
                          >
                            <Usb size={12} className="shrink-0" />
                            <span className="font-mono flex-1">{p.path}</span>
                            {p.manufacturer && (
                              <span className="text-[10px] opacity-70">{p.manufacturer}</span>
                            )}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {settings.enttecPort && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border px-3 py-2 text-xs">
                    <Usb size={11} className="shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">Selected:</span>
                    <span className="font-mono">{settings.enttecPort}</span>
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1">
                  <p>• Enttec DMX USB PRO Mk2 / Mk3 supported</p>
                  <p>• Protocol: 57600 baud, Enttec Pro API (Label 6)</p>
                  <p>• Only Port A (Universe 1) is used</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button size="sm" className="h-8 gap-1" onClick={saveSettings} disabled={isSaving}>
                <Save size={13} />
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button
                size="sm"
                variant={engineRunning ? "destructive" : "outline"}
                className="h-8 gap-1"
                onClick={engineRunning ? stopEngine : startEngine}
                disabled={settings.dmxInterface === "enttec" && !settings.enttecPort}
              >
                {engineRunning ? <Square size={13} /> : <Play size={13} />}
                {engineRunning ? "Stop Output" : "Start Output"}
              </Button>
              {settings.dmxInterface === "enttec" && !settings.enttecPort && !engineRunning && (
                <span className="text-[10px] text-muted-foreground">Select a port first</span>
              )}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">API Access</h2>
            <p className="text-xs text-muted-foreground">
              Your AI agent and Bitfocus Companion can connect using these endpoints:
            </p>
            <div className="space-y-2">
              <div className="bg-muted rounded p-3 font-mono text-xs space-y-1">
                <div className="text-muted-foreground">HTTP REST API:</div>
                <div>http://localhost:3333/api/v1/</div>
              </div>
              <div className="bg-muted rounded p-3 font-mono text-xs space-y-1">
                <div className="text-muted-foreground">WebSocket:</div>
                <div>ws://localhost:3333/ws</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Key endpoints:</strong></p>
              <p>• GET /api/v1/universe — read all 512 channels</p>
              <p>• POST /api/v1/universe — set channels {"{ channels: {\"1\": 255} }"}</p>
              <p>• POST /api/v1/scenes/:id/recall — recall a scene</p>
              <p>• GET /api/v1/fixtures — list all fixtures</p>
              <p>• GET /api/v1/ports — list available serial ports</p>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
