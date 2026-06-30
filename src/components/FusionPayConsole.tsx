import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Key,
  Database,
  RefreshCw,
  Terminal,
  Send,
  Building,
  Lock,
  FileText,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  LockKeyhole,
  Globe,
  Plus,
  Trash2,
  Check,
  Zap,
  Activity
} from 'lucide-react';

interface BankInstitution {
  id: string;
  name: string;
  country: string;
  fullName: string;
  environment: string;
  type: string;
}

const MOCK_INSTITUTIONS: Record<string, BankInstitution[]> = {
  GB: [
    { id: 'gb-barclays', name: 'Barclays Bank', country: 'GB', fullName: 'Barclays Personal Banking', environment: 'LIVE', type: 'CHALLENGER' },
    { id: 'gb-monzo', name: 'Monzo Bank', country: 'GB', fullName: 'Monzo Bank Limited', environment: 'LIVE', type: 'NEOBANK' },
    { id: 'gb-revolut', name: 'Revolut App', country: 'GB', fullName: 'Revolut Ltd', environment: 'LIVE', type: 'NEOBANK' },
    { id: 'gb-hsbc', name: 'HSBC UK', country: 'GB', fullName: 'HSBC Bank plc', environment: 'LIVE', type: 'TRADITIONAL' },
    { id: 'gb-lloyds', name: 'Lloyds Bank', country: 'GB', fullName: 'Lloyds Bank Commercial', environment: 'LIVE', type: 'TRADITIONAL' }
  ],
  US: [
    { id: 'us-chase', name: 'JP Morgan Chase', country: 'US', fullName: 'Chase Bank NA', environment: 'LIVE', type: 'TRADITIONAL' },
    { id: 'us-boa', name: 'Bank of America', country: 'US', fullName: 'Bank of America Merrill Lynch', environment: 'LIVE', type: 'TRADITIONAL' },
    { id: 'us-wells', name: 'Wells Fargo', country: 'US', fullName: 'Wells Fargo Bank NA', environment: 'LIVE', type: 'TRADITIONAL' },
    { id: 'us-chime', name: 'Chime', country: 'US', fullName: 'Chime Financial Inc', environment: 'LIVE', type: 'NEOBANK' }
  ],
  DE: [
    { id: 'de-n26', name: 'N26 Bank', country: 'DE', fullName: 'N26 GmbH', environment: 'LIVE', type: 'NEOBANK' },
    { id: 'de-deutsche', name: 'Deutsche Bank', country: 'DE', fullName: 'Deutsche Bank AG Private', environment: 'LIVE', type: 'TRADITIONAL' },
    { id: 'de-commerzbank', name: 'Commerzbank', country: 'DE', fullName: 'Commerzbank AG', environment: 'LIVE', type: 'TRADITIONAL' }
  ],
  BD: [
    { id: 'bd-rubel', name: 'Sheikh Rubel Bank', country: 'BD', fullName: 'Sovereign Bank of Rubel (Anycast)', environment: 'LIVE', type: 'SOVEREIGN' },
    { id: 'bd-brac', name: 'BRAC Bank', country: 'BD', fullName: 'BRAC Bank plc', environment: 'LIVE', type: 'TRADITIONAL' },
    { id: 'bd-city', name: 'The City Bank', country: 'BD', fullName: 'City Bank Limited Digital', environment: 'LIVE', type: 'TRADITIONAL' }
  ]
};

interface WebhookConfig {
  id: string;
  url: string;
  events: ('SUCCESS' | 'ROLLBACKED')[];
  secret: string;
  status: 'active' | 'inactive';
  createdTime: string;
}

interface WebhookLog {
  id: string;
  timestamp: string;
  url: string;
  event: 'SUCCESS' | 'ROLLBACKED';
  payload: any;
  status: 'SUCCESS' | 'FAILED';
  responseCode: number;
  responseText: string;
}

const DEFAULT_WEBHOOKS: WebhookConfig[] = [
  {
    id: 'wh_sheikh_prod',
    url: 'https://core.sheikh/api/v1/webhooks',
    events: ['SUCCESS', 'ROLLBACKED'],
    secret: 'whsec_sheikh_signature_key_9988',
    status: 'active',
    createdTime: new Date(Date.now() - 86400000 * 2).toLocaleString()
  }
];

interface AuditLog {
  tx_id: string;
  senderName: string;
  senderUsername: string;
  receiverName: string;
  receiverUsername: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'ROLLBACKED';
  timestamp: string;
  note: string;
}

interface BankUser {
  id: string;
  name: string;
  username: string;
  telegramId: string;
  appBalance: number;
  telegramBalance: number;
  linked: boolean;
  avatar: string;
}

interface FusionPayConsoleProps {
  auditLogs?: AuditLog[];
  users?: BankUser[];
  activeUser?: BankUser;
  onTelegramTransfer?: (recipientId: string, amount: number) => Promise<{ success: boolean; message: string }>;
}

export const FusionPayConsole: React.FC<FusionPayConsoleProps> = ({ 
  auditLogs = [], 
  users = [], 
  activeUser, 
  onTelegramTransfer 
}) => {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'security' | 'webhooks' | 'code'>('sandbox');
  
  // Dedicated single Webhook URL state
  const [registeredWebhookUrl, setRegisteredWebhookUrl] = useState<string>('https://core.sheikh/api/v1/webhooks');
  const [directWebhookInput, setDirectWebhookInput] = useState<string>('https://core.sheikh/api/v1/webhooks');
  const [showWebhookSuccessMsg, setShowWebhookSuccessMsg] = useState<boolean>(false);

  // Dedicated single Webhook connection testing state
  const [isTestingDirectConnection, setIsTestingDirectConnection] = useState<boolean>(false);
  const [directConnectionLog, setDirectConnectionLog] = useState<{
    id: string;
    timestamp: string;
    url: string;
    status: 'SUCCESS' | 'FAILED';
    responseCode: number;
    responseText: string;
    payload: any;
    latency: number;
  } | null>(null);
  const [directConnectionLogs, setDirectConnectionLogs] = useState<Array<{
    id: string;
    timestamp: string;
    url: string;
    status: 'SUCCESS' | 'FAILED';
    responseCode: number;
    responseText: string;
    payload: any;
    latency: number;
  }>>([]);

  // Webhooks State
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(DEFAULT_WEBHOOKS);
  const [newUrl, setNewUrl] = useState<string>('');
  const [selectedEvents, setSelectedEvents] = useState<('SUCCESS' | 'ROLLBACKED')[]>(['SUCCESS', 'ROLLBACKED']);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<string | null>(null);
  const [testEventType, setTestEventType] = useState<'SUCCESS' | 'ROLLBACKED'>('SUCCESS');
  const [copiedWhId, setCopiedWhId] = useState<string | null>(null);

  // Telegram Balance Transfer States
  const [telegramRecipientId, setTelegramRecipientId] = useState<string>('');
  const [telegramAmount, setTelegramAmount] = useState<string>('150');
  const [isSendingTelegram, setIsSendingTelegram] = useState<boolean>(false);

  // Telegram Live Sync Bridge States
  const [isPingPonging, setIsPingPonging] = useState<boolean>(false);
  const [pingLatency, setPingLatency] = useState<number>(14);
  const [lastHandshakeTime, setLastHandshakeTime] = useState<string>('Just now');
  const [bridgeStatus, setBridgeStatus] = useState<'CONNECTED' | 'DISCONNECTED'>('CONNECTED');

  const triggerPingPongCheck = async () => {
    setIsPingPonging(true);
    // Simulate real handshake delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    setPingLatency(Math.floor(Math.random() * 15) + 8); // 8ms to 23ms
    const now = new Date();
    setLastHandshakeTime(now.toLocaleTimeString());
    setBridgeStatus('CONNECTED');
    setIsPingPonging(false);
  };

  useEffect(() => {
    if (users.length > 0 && activeUser) {
      const firstRecipient = users.find(u => u.id !== activeUser.id);
      if (firstRecipient && !telegramRecipientId) {
        setTelegramRecipientId(firstRecipient.id);
      }
    }
  }, [users, activeUser, telegramRecipientId]);

  // Monitor auditLogs for real-time simulated webhook dispatches
  const processedTxIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Utility function to dispatch a webhook payload to the registered Webhook URL on transaction status changes
    const sendWebhookNotification = async (log: AuditLog) => {
      if (!registeredWebhookUrl) return;

      const payload = {
        event: log.status,
        timestamp: new Date().toISOString(),
        webhook_id: 'wh_registered_direct',
        data: {
          tx_id: log.tx_id,
          senderName: log.senderName,
          senderUsername: log.senderUsername,
          receiverName: log.receiverName,
          receiverUsername: log.receiverUsername,
          amount: log.amount,
          status: log.status,
          note: log.note,
        },
        security: {
          signature_version: 'v1',
          signed_with: 'SHA256'
        }
      };

      const logId = `whlog_reg_${Math.random().toString(36).substring(2, 10)}`;
      let deliveryStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
      let responseCode = 200;
      let responseText = 'OK';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(registeredWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-FusionPay-Signature': 'whsec_registered_direct',
            'X-FusionPay-Event': log.status,
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        responseCode = response.status;
        responseText = response.statusText || `${response.status} Code`;
        if (!response.ok) {
          deliveryStatus = 'FAILED';
        }
      } catch (err: any) {
        deliveryStatus = 'FAILED';
        responseCode = 0;
        responseText = err.name === 'AbortError'
          ? 'Connection Timeout (4000ms)'
          : `${err.message || 'Network Error'} (Typically CORS restrictions)`;
      }

      const newLog: WebhookLog = {
        id: logId,
        timestamp: new Date().toLocaleString(),
        url: registeredWebhookUrl,
        event: log.status as any,
        payload,
        status: deliveryStatus,
        responseCode,
        responseText
      };

      setWebhookLogs(prev => [newLog, ...prev]);
    };

    // On mount, populate the already processed transaction IDs to avoid flood
    if (processedTxIds.current.size === 0 && auditLogs.length > 0) {
      auditLogs.forEach(log => {
        processedTxIds.current.add(log.tx_id);
      });
      return;
    }

    // Identify new transactions
    const newTransactions = auditLogs.filter(log => !processedTxIds.current.has(log.tx_id));
    
    // Add them to processed set
    newTransactions.forEach(log => {
      processedTxIds.current.add(log.tx_id);
      
      // If status matches SUCCESS or ROLLBACKED, trigger simulated notification to active webhooks
      if (log.status === 'SUCCESS' || log.status === 'ROLLBACKED') {
        // Trigger the dedicated utility function for registeredWebhookUrl if saved
        sendWebhookNotification(log);

        // Find active webhooks subscribed to this event (excluding the registeredWebhookUrl which is handled separately)
        const activeSubscribedWhs = webhooks.filter(wh => wh.status === 'active' && wh.events.includes(log.status as any) && wh.url !== registeredWebhookUrl);
        
        activeSubscribedWhs.forEach(async (wh) => {
          const payload = {
            event: log.status,
            timestamp: new Date().toISOString(),
            webhook_id: wh.id,
            data: {
              tx_id: log.tx_id,
              senderName: log.senderName,
              senderUsername: log.senderUsername,
              receiverName: log.receiverName,
              receiverUsername: log.receiverUsername,
              amount: log.amount,
              status: log.status,
              note: log.note,
            },
            security: {
              signature_version: 'v1',
              signed_with: 'SHA256'
            }
          };

          const logId = `whlog_${Math.random().toString(36).substring(2, 10)}`;
          let deliveryStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
          let responseCode = 200;
          let responseText = 'OK';

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const response = await fetch(wh.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-FusionPay-Signature': wh.secret,
                'X-FusionPay-Event': log.status,
              },
              body: JSON.stringify(payload),
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            responseCode = response.status;
            responseText = response.statusText || `${response.status} Code`;
            if (!response.ok) {
              deliveryStatus = 'FAILED';
            }
          } catch (err: any) {
            deliveryStatus = 'FAILED';
            responseCode = 0;
            responseText = err.name === 'AbortError' 
              ? 'Connection Timeout (4000ms)' 
              : `${err.message || 'Network Error'} (Typically CORS restrictions)`;
          }

          const newLog: WebhookLog = {
            id: logId,
            timestamp: new Date().toLocaleString(),
            url: wh.url,
            event: log.status as any,
            payload,
            status: deliveryStatus,
            responseCode,
            responseText
          };

          setWebhookLogs(prev => [newLog, ...prev]);
        });
      }
    });
  }, [auditLogs, webhooks, registeredWebhookUrl]);

  // Sandbox State
  const [apiEndpoint, setApiEndpoint] = useState<'stripe' | 'institutions'>('stripe');
  const [stripeAmount, setStripeAmount] = useState<number>(2000);
  const [stripeCurrency, setStripeCurrency] = useState<string>('usd');
  const [yapilyCountry, setYapilyCountry] = useState<string>('GB');
  
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<any | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  // Security Simulator state
  const [apiKeyRotationTime, setApiKeyRotationTime] = useState<string>(new Date().toLocaleString());
  const [activeSecretHash, setActiveSecretHash] = useState<string>('whsec_7d5e4a81b211f379ea04964101e');
  const [isRotating, setIsRotating] = useState<boolean>(false);

  // Send Telegram balance handler
  const handleSendTelegramBalanceSubmit = async () => {
    if (!onTelegramTransfer) return;
    if (!telegramRecipientId) return;
    
    const amount = Number(telegramAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    setIsSendingTelegram(true);
    await handleSendTelegramBalanceSubmitWithDelay(telegramRecipientId, amount);
  };

  const handleSendTelegramBalanceSubmitWithDelay = async (recipientId: string, amount: number) => {
    // Simulate network latency of 1000ms
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (onTelegramTransfer) {
      await onTelegramTransfer(recipientId, amount);
    }
    setIsSendingTelegram(false);
  };

  // Run simulated request
  const handleExecuteRequest = () => {
    setIsRequesting(true);
    setApiResponse(null);
    setStatusCode(null);
    setResponseTime(null);

    setTimeout(() => {
      const startTime = performance.now();
      let responseBody = {};
      
      if (apiEndpoint === 'stripe') {
        const clientSecret = `pi_${Math.random().toString(36).substring(2, 10)}_secret_${Math.random().toString(36).substring(2, 12)}`;
        responseBody = {
          object: 'payment_intent',
          id: `pi_${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
          amount: stripeAmount,
          currency: stripeCurrency,
          status: 'requires_payment_method',
          client_secret: clientSecret,
          livemode: false,
          created: Math.floor(Date.now() / 1000),
          metadata: {
            integration: 'FusionPay v1.2.0-stable',
            source: 'core.sheikh-anycast',
            domain_routed: 'https://core.sheikh/api'
          },
          payment_method_types: ['card', 'link']
        };
        setStatusCode(201);
      } else {
        const institutions = MOCK_INSTITUTIONS[yapilyCountry] || [];
        responseBody = {
          success: true,
          count: institutions.length,
          total_system_institutions: 14205,
          country_code: yapilyCountry,
          cached: true,
          cache_ttl_seconds: 1800,
          institutions: institutions.map(i => ({
            id: i.id,
            name: i.name,
            fullName: i.fullName,
            country: i.country,
            type: i.type,
            environment: i.environment,
            anycast_latencies: {
              node_42: '0.45ms',
              node_primary: '1.2ms'
            }
          }))
        };
        setStatusCode(200);
      }

      setApiResponse(responseBody);
      setResponseTime(Math.round(performance.now() - startTime + 12)); // mock network + server time
      setIsRequesting(false);
    }, 450);
  };

  // Run simulated key rotation
  const handleRotateKey = () => {
    setIsRotating(true);
    setTimeout(() => {
      const chars = '0123456789abcdef';
      let result = 'whsec_';
      for (let i = 0; i < 24; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      setActiveSecretHash(result);
      setApiKeyRotationTime(new Date().toLocaleString());
      setIsRotating(false);
    }, 1200);
  };

  // Webhooks Action Handlers
  const handleAddWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      alert('অনুগ্রহ করে একটি সঠিক ইউআরএল (http:// বা https:// দিয়ে শুরু) প্রদান করুন।');
      return;
    }

    const newWh: WebhookConfig = {
      id: `wh_${Math.random().toString(36).substring(2, 10)}`,
      url: newUrl,
      events: selectedEvents,
      secret: `whsec_${Math.random().toString(36).substring(2, 15)}`,
      status: 'active',
      createdTime: new Date().toLocaleString()
    };
    
    setWebhooks(prev => [...prev, newWh]);
    setNewUrl('');
    setIsAdding(false);
  };

  const handleDeleteWebhook = (id: string) => {
    setWebhooks(prev => prev.filter(wh => wh.id !== id));
  };

  const handleToggleStatus = (id: string) => {
    setWebhooks(prev => prev.map(wh => wh.id === id ? { ...wh, status: wh.status === 'active' ? 'inactive' : 'active' } : wh));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWhId(id);
    setTimeout(() => setCopiedWhId(null), 2000);
  };

  const handleTestWebhook = async (webhook: WebhookConfig) => {
    setIsTestingWebhook(webhook.id);
    
    const simulatedTxId = `tx_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const payload = {
      event: testEventType,
      timestamp: new Date().toISOString(),
      webhook_id: webhook.id,
      data: {
        tx_id: simulatedTxId,
        senderName: 'Sheikh Rubel',
        senderUsername: 'sheikhrubel',
        receiverName: 'Anika Rahman',
        receiverUsername: 'anika_rahman',
        amount: 1500,
        status: testEventType,
        note: testEventType === 'SUCCESS' ? 'P2P Transfer via Web App' : 'Balance Transfer Rollbacked',
      },
      security: {
        signature_version: 'v1',
        signed_with: 'SHA256'
      }
    };

    const logId = `whlog_${Math.random().toString(36).substring(2, 10)}`;
    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let responseCode = 200;
    let responseText = 'OK';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FusionPay-Signature': webhook.secret,
          'X-FusionPay-Event': testEventType,
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      responseCode = response.status;
      responseText = response.statusText || `${response.status} Code`;
      if (!response.ok) {
        status = 'FAILED';
      }
    } catch (err: any) {
      status = 'FAILED';
      responseCode = 0;
      responseText = err.name === 'AbortError' 
        ? 'Connection Timeout (4000ms)' 
        : `${err.message || 'Network Error'} (Typically CORS restrictions)`;
    }

    const newLog: WebhookLog = {
      id: logId,
      timestamp: new Date().toLocaleString(),
      url: webhook.url,
      event: testEventType,
      payload,
      status,
      responseCode,
      responseText
    };

    setWebhookLogs(prev => [newLog, ...prev]);
    setIsTestingWebhook(null);
  };

  const handleTestDirectConnection = async () => {
    if (!registeredWebhookUrl) return;
    setIsTestingDirectConnection(true);

    const startTime = Date.now();
    
    // Simulate network latency of 800ms to 1500ms using setTimeout Promise
    const simulatedLatency = Math.floor(Math.random() * 700) + 800;
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));

    const simulatedTxId = `tx_test_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const payload = {
      event: 'TEST_CONNECTION',
      timestamp: new Date().toISOString(),
      webhook_id: 'wh_registered_direct_test',
      data: {
        tx_id: simulatedTxId,
        test_mode: true,
        message: 'FusionPay webhook connection verification test',
        senderName: 'Test Suite',
        senderUsername: 'test_suite',
        amount: 0.01,
        status: 'SUCCESS'
      },
      security: {
        signature_version: 'v1',
        signed_with: 'SHA256'
      }
    };

    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let responseCode = 200;
    let responseText = 'OK';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const response = await fetch(registeredWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FusionPay-Signature': 'whsec_registered_direct_test',
          'X-FusionPay-Event': 'TEST_CONNECTION',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      responseCode = response.status;
      responseText = response.statusText || `${response.status} Code`;
      if (!response.ok) {
        status = 'FAILED';
      }
    } catch (err: any) {
      status = 'FAILED';
      responseCode = 0;
      responseText = err.name === 'AbortError'
        ? 'Connection Timeout (4500ms)'
        : `${err.message || 'Network Error'} (Typically CORS restrictions)`;
    }

    const totalLatency = Date.now() - startTime;
    const logId = `whlog_direct_test_${Math.random().toString(36).substring(2, 10)}`;

    const testLog = {
      id: logId,
      timestamp: new Date().toLocaleTimeString() + ' ' + new Date().toLocaleDateString(),
      url: registeredWebhookUrl,
      status,
      responseCode,
      responseText,
      payload,
      latency: totalLatency
    };

    setDirectConnectionLog(testLog);
    setDirectConnectionLogs(prev => [testLog, ...prev]);
    setIsTestingDirectConnection(false);

    // Also add to the main webhook delivery logs list so it displays in webhooks log too
    const newLog: WebhookLog = {
      id: logId,
      timestamp: new Date().toLocaleString(),
      url: registeredWebhookUrl,
      event: 'SUCCESS',
      payload,
      status,
      responseCode,
      responseText
    };
    setWebhookLogs(prev => [newLog, ...prev]);
  };

  return (
    <div className="col-span-12 mt-6" id="fusionpay_console">
      <div className="bg-gradient-to-b from-[#111625] to-[#0A0D18] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[150px] bg-indigo-500/5 rounded-full filter blur-[60px] pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/60">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
                FusionPay Secure API Sandbox
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono">
                  v1.2.0-stable
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Institutional-Grade Financial Integrations & Sandbox Environment • Verified Anycast Routed to .sheikh
            </p>
          </div>

          {/* Tab Selection */}
          <div className="flex bg-[#070A14] p-1 rounded-xl border border-slate-850 self-start md:self-center">
            <button
              onClick={() => setActiveTab('sandbox')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sandbox'
                  ? 'bg-indigo-650 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" /> Sandbox UI
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'security'
                  ? 'bg-indigo-650 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LockKeyhole className="h-3.5 w-3.5" /> Security Guard
            </button>
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'webhooks'
                  ? 'bg-indigo-650 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="h-3.5 w-3.5" /> Webhooks
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'code'
                  ? 'bg-indigo-650 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Code Reference
            </button>
          </div>
        </div>

        {/* SINGLE WEBHOOK URL QUICK-REGISTRATION SYSTEM */}
        <div className="bg-[#0D1221] border border-slate-800 rounded-xl p-4 mb-6 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 shrink-0">
                <Globe className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex flex-wrap items-center gap-2">
                  <span>নিবন্ধিত ওয়েব হুক ইউআরএল (Active Webhook Target)</span>
                  {registeredWebhookUrl ? (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-mono shrink-0">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-md font-mono shrink-0">
                      NOT REGISTERED
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 break-all select-all">
                  {registeredWebhookUrl ? (
                    <>সক্রিয় জিপিও গন্তব্য: <code className="text-indigo-300 font-mono break-all">{registeredWebhookUrl}</code></>
                  ) : (
                    "Please register a target webhook endpoint below."
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full lg:w-auto lg:min-w-[420px]">
              <div className="flex flex-col flex-1 min-w-0">
                <label htmlFor="webhook-url-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Webhook URL</label>
                <input
                  id="webhook-url-input"
                  type="url"
                  placeholder="https://core.sheikh/api/v1/webhooks"
                  value={directWebhookInput}
                  onChange={(e) => setDirectWebhookInput(e.target.value)}
                  className="w-full bg-[#050810] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 h-10 select-all"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => {
                    if (!directWebhookInput) return;
                    if (!directWebhookInput.startsWith('http://') && !directWebhookInput.startsWith('https://')) {
                      alert('Please enter a valid URL starting with http:// or https://');
                      return;
                    }
                    setRegisteredWebhookUrl(directWebhookInput);
                    setShowWebhookSuccessMsg(true);
                    setTimeout(() => setShowWebhookSuccessMsg(false), 3500);
                    
                    // Add to webhooks list if it doesn't exist
                    const alreadyExists = webhooks.some(w => w.url === directWebhookInput);
                    if (!alreadyExists) {
                      const newWh: WebhookConfig = {
                        id: `wh_direct_${Math.random().toString(36).substring(2, 6)}`,
                        url: directWebhookInput,
                        events: ['SUCCESS', 'ROLLBACKED'],
                        secret: `whsec_direct_${Math.random().toString(36).substring(2, 10)}`,
                        status: 'active',
                        createdTime: new Date().toLocaleString()
                      };
                      setWebhooks(prev => [...prev, newWh]);
                    }
                  }}
                  className="flex-1 sm:flex-initial justify-center bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5 h-10 shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                  Register
                </button>

                {registeredWebhookUrl && (
                  <button
                    onClick={handleTestDirectConnection}
                    disabled={isTestingDirectConnection}
                    className="flex-1 sm:flex-initial justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 hover:text-indigo-200 border border-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5 h-10 shrink-0"
                  >
                    {isTestingDirectConnection ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="h-3.5 w-3.5" />
                    )}
                    Test Connection
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Success Confirmation Alert */}
          {showWebhookSuccessMsg && (
            <div className="mt-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2.5 text-emerald-400 text-xs animate-fadeIn">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Success!</strong> Webhook target URL has been updated and registered successfully to <strong>{directWebhookInput}</strong>.
              </span>
            </div>
          )}

          {/* Connection Logs Section */}
          {directConnectionLogs.length > 0 && (
            <div className="mt-4 bg-[#050810]/90 border border-slate-800 rounded-xl p-4 animate-fadeIn text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2 font-semibold text-slate-200">
                  <Terminal className="h-4 w-4 text-indigo-400" />
                  <span>Connection Logs (সংযোগ পরীক্ষা লগসমূহ)</span>
                </div>
                <button
                  onClick={() => {
                    setDirectConnectionLogs([]);
                    setDirectConnectionLog(null);
                  }}
                  className="text-[10px] text-slate-500 hover:text-red-400 font-mono flex items-center gap-1 transition-all"
                >
                  <Trash2 className="h-3 w-3" /> Clear History
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Logs History List */}
                <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-800/60 pb-4 lg:pb-0 pr-0 lg:pr-4 space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Test History</div>
                  {directConnectionLogs.map((log) => {
                    const isSelected = directConnectionLog?.id === log.id;
                    return (
                      <button
                        key={log.id}
                        onClick={() => setDirectConnectionLog(log)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-950/25 border-indigo-500/40 text-slate-200'
                            : 'bg-[#080B13]/40 border-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-[#080B13]/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-500">{log.timestamp}</span>
                          <span className="text-[10px] font-mono text-indigo-400 font-bold">{log.latency}ms</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate max-w-[150px] font-mono text-[11px] text-slate-300">{log.url}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {log.status === 'SUCCESS' ? (
                              <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">{log.responseCode} OK</span>
                            ) : (
                              <span className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">{log.responseCode || 'ERR'}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Log Details Panel */}
                <div className="lg:col-span-7 bg-[#03050a] border border-slate-900 rounded-lg p-3 space-y-3">
                  {directConnectionLog ? (
                    <>
                      <div className="flex items-center justify-between text-[10px] border-b border-slate-800/60 pb-2">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Log Details</span>
                        <span className="font-mono text-slate-500">ID: {directConnectionLog.id}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="space-y-1">
                          <div className="text-slate-500">Target URL:</div>
                          <div className="text-slate-300 break-all select-all">{directConnectionLog.url}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-slate-500">Latency & Response:</div>
                          <div className="flex items-center gap-2">
                            <span className="text-indigo-400 font-bold">{directConnectionLog.latency}ms</span>
                            <span className={directConnectionLog.responseCode >= 200 && directConnectionLog.responseCode < 300 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                              Code {directConnectionLog.responseCode || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 text-[11px] font-mono">
                        <span className="text-slate-500">Response Message:</span>
                        <div className="p-2 bg-slate-950 rounded border border-slate-900 text-slate-300 select-all max-h-[60px] overflow-y-auto scrollbar-thin">
                          {directConnectionLog.responseText}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Dispatched Payload (JSON)</span>
                        <pre className="p-2 bg-slate-950 rounded border border-slate-900 overflow-x-auto text-[10px] leading-relaxed text-indigo-300/90 max-h-[120px] scrollbar-thin font-mono">
                          {JSON.stringify(directConnectionLog.payload, null, 2)}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <Terminal className="h-8 w-8 text-slate-600 mb-2 animate-pulse" />
                      <p className="text-xs">Select a connection test attempt from the left panel to inspect details.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: SANDBOX UI */}
        {activeTab === 'sandbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Control Panel (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#141A2E]/40 border border-slate-800 rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-indigo-400" /> এপিআই রিকোয়েস্ট উইজার্ড (API Dispatcher)
                </h3>

                {/* Endpoint Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">পদ্ধতি ও শেষবিন্দু (Select Route)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setApiEndpoint('stripe');
                        setApiResponse(null);
                        setStatusCode(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        apiEndpoint === 'stripe'
                          ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300'
                          : 'bg-[#080B13]/60 border-slate-850 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">POST</div>
                      <div className="text-xs font-mono font-bold mt-0.5">.../stripe/create-intent</div>
                    </button>
                    <button
                      onClick={() => {
                        setApiEndpoint('institutions');
                        setApiResponse(null);
                        setStatusCode(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        apiEndpoint === 'institutions'
                          ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300'
                          : 'bg-[#080B13]/60 border-slate-850 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[9px] font-black text-sky-500 uppercase tracking-widest">GET</div>
                      <div className="text-xs font-mono font-bold mt-0.5">.../banking/institutions</div>
                    </button>
                  </div>
                </div>

                {/* Conditional Fields: STRIPE */}
                {apiEndpoint === 'stripe' && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">পেমেন্ট পরিমাণ (Amount in BDT equivalent)</label>
                      <input
                        type="number"
                        value={stripeAmount}
                        onChange={(e) => setStripeAmount(Number(e.target.value))}
                        className="w-full bg-[#080B13]/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                        min="1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">মুদ্রা (Currency)</label>
                      <select
                        value={stripeCurrency}
                        onChange={(e) => setStripeCurrency(e.target.value)}
                        className="w-full bg-[#080B13]/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                      >
                        <option value="usd">USD ($) - Global Core</option>
                        <option value="bdt">BDT (৳) - Sovereign Local</option>
                        <option value="gbp">GBP (£) - UK Direct Clearing</option>
                        <option value="eur">EUR (€) - European Central</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Conditional Fields: YAPILY */}
                {apiEndpoint === 'institutions' && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">দেশ নির্বাচন (Country Code Query)</label>
                      <select
                        value={yapilyCountry}
                        onChange={(e) => setYapilyCountry(e.target.value)}
                        className="w-full bg-[#080B13]/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                      >
                        <option value="GB">United Kingdom (GB - 14,000+ support)</option>
                        <option value="US">United States (US - Direct FedNow)</option>
                        <option value="DE">Germany (DE - Bundesbank / SEPA)</option>
                        <option value="BD">Bangladesh (BD - Sovereign Anycast Node)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Execute Button */}
                <button
                  onClick={handleExecuteRequest}
                  disabled={isRequesting}
                  className="w-full bg-gradient-to-r from-indigo-650 to-indigo-800 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg hover:shadow-indigo-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isRequesting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      অনুরোধ প্রক্রিয়াকরণ হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      অনুরোধ পাঠান (Send Intent API Request)
                    </>
                  )}
                </button>
              </div>

              {/* Telegram Wallet Transfer Card */}
              <div className="bg-[#141A2E]/40 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      টেলিগ্রাম ওয়ালেট ব্যালেন্স ট্রান্সফার (Telegram Wallet Transfer)
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      সরাসরি ওয়ালেট থেকে অন্য ব্যবহারকারীর ওয়ালেটে ব্যালেন্স পাঠান
                    </p>
                  </div>
                </div>

                {/* Sender Wallet Info */}
                <div className="bg-[#050810]/60 border border-slate-850/60 rounded-xl p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {activeUser?.avatar ? (
                      <img src={activeUser.avatar} alt="avatar" className="h-6 w-6 rounded-full border border-slate-700" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-[10px]">
                        {activeUser?.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-300 truncate">{activeUser?.name || 'User'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">@{activeUser?.username || 'username'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">টেলিগ্রাম ব্যালেন্স</div>
                    <div className="text-sm font-black text-indigo-400 font-mono">
                      {(activeUser?.telegramBalance || 0).toLocaleString('bn-BD')} BDT
                    </div>
                  </div>
                </div>

                {/* Recipient Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    প্রাপক নির্বাচন করুন (Select Recipient)
                  </label>
                  <select
                    value={telegramRecipientId}
                    onChange={(e) => setTelegramRecipientId(e.target.value)}
                    className="w-full bg-[#080B13]/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {users.filter(u => u.id !== activeUser?.id).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} (@{u.username}) — Balance: {u.telegramBalance} BDT
                      </option>
                    ))}
                    {users.filter(u => u.id !== activeUser?.id).length === 0 && (
                      <option value="">No other recipients available</option>
                    )}
                  </select>
                </div>

                {/* Amount Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      পরিমাণ (Amount in BDT)
                    </label>
                    <span className="text-[9px] text-slate-500 font-mono">
                      Min: 1 BDT
                    </span>
                  </div>
                  <input
                    type="number"
                    value={telegramAmount}
                    onChange={(e) => setTelegramAmount(e.target.value)}
                    placeholder="150"
                    min="1"
                    className="w-full bg-[#080B13]/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  {/* Quick Select Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {[100, 300, 500].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setTelegramAmount(amt.toString())}
                        className="bg-slate-900/60 hover:bg-[#1e293b] border border-slate-800 rounded-lg py-1 text-[10px] font-mono font-bold text-slate-450 hover:text-indigo-400 transition-all cursor-pointer"
                      >
                        ৳{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transfer Action Button */}
                <button
                  onClick={handleSendTelegramBalanceSubmit}
                  disabled={isSendingTelegram || !telegramRecipientId || !activeUser || activeUser.telegramBalance < Number(telegramAmount) || Number(telegramAmount) <= 0}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 disabled:from-slate-800 disabled:to-slate-850 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg hover:shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSendingTelegram ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ট্রান্সফার করা হচ্ছে (Transferring)...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      টেলিগ্রাম ব্যালেন্স পাঠান (Send Telegram Balance)
                    </>
                  )}
                </button>
              </div>

              {/* Real-time system diagnostics info card */}
              <div className="bg-slate-900/30 border border-slate-850 rounded-xl p-3.5 text-[11px] text-slate-450 space-y-1.5">
                <div className="flex justify-between">
                  <span>SSL Handshake Protection:</span>
                  <span className="text-emerald-400 font-mono font-bold">TLS v1.3 ACTIVE</span>
                </div>
                <div className="flex justify-between">
                  <span>DNS Anycast Tunnel:</span>
                  <span className="text-emerald-400 font-mono">10.42.0.1 (core.sheikh)</span>
                </div>
                <div className="flex justify-between">
                  <span>Least Privilege Policy:</span>
                  <span className="text-indigo-400 font-mono">Restricted-API-Guard</span>
                </div>
              </div>
            </div>

            {/* Output Terminal (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div className="bg-[#070A14] border border-slate-850 rounded-xl overflow-hidden flex flex-col h-full min-h-[300px]">
                {/* Terminal Header */}
                <div className="bg-[#0C101F] px-4 py-2.5 border-b border-slate-850 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                    <span className="text-[10px] text-slate-400 font-mono ml-2 font-bold">RELIABLE FINTECH OUTPUT TRACE</span>
                  </div>
                  {statusCode && (
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold ${
                        statusCode >= 200 && statusCode < 300
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        STATUS: {statusCode} {statusCode === 201 ? 'CREATED' : 'OK'}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">{responseTime}ms</span>
                    </div>
                  )}
                </div>

                {/* Terminal Body */}
                <div className="p-4 font-mono text-[11px] text-slate-300 flex-1 overflow-auto max-h-[280px]">
                  {isRequesting ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-400 mb-2" />
                      <span>CONNECTING TO SECURE GATEWAY ENVELOPE...</span>
                    </div>
                  ) : apiResponse ? (
                    <div className="space-y-3">
                      <div className="text-slate-500 border-b border-slate-900 pb-1 flex justify-between">
                        <span>HTTP/1.1 {statusCode} {statusCode === 201 ? 'Created' : 'OK'}</span>
                        <span>Date: {new Date().toUTCString()}</span>
                      </div>
                      <pre className="text-emerald-400 font-mono whitespace-pre-wrap select-all">
                        {JSON.stringify(apiResponse, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-12">
                      <Terminal className="h-8 w-8 text-slate-700 mb-2" />
                      <span>রানিং উইজার্ডে ইনপুট দিয়ে অনুরোধ প্রেরণ করুন।</span>
                      <span className="text-[10px] text-slate-600 mt-1">
                        Console will intercept secure backend API response envelope locally.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY COMPLIANCE */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Warning Message */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3.5">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-400">গুরুত্বপূর্ণ নিরাপত্তা নির্দেশিকা (Zero Client-Side Secret Leak policy)</h4>
                <p className="text-[11px] text-slate-450 mt-1 leading-relaxed">
                  কখনোই আপনার Stripe Secret Key বা Yapily Credentials ক্লায়েন্ট-সাইড কোডে লিখবেন না। আপনার শেখ কোড এক্সচেঞ্জ এবং ফিউশন পে সমস্ত পেমেন্ট গেটওয়ে লজিক সম্পূর্ণ নিরাপদ সার্ভার সাইড প্রক্সি এবং .env ফাইল দ্বারা সুরক্ষিত রাখে।
                </p>
              </div>
            </div>

            {/* Metrics cards and rotation simulator */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Compliance 1: Key Storage */}
              <div className="bg-[#121727]/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-200">১. এনভায়রনমেন্ট স্টোরেজ</span>
                    <Key className="h-4 w-4 text-indigo-400" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    সব সিক্রেট চাবিকাঠি `.env` ফাইলে সংরক্ষিত এবং সার্ভার সোর্স কোডে `process.env` দিয়ে অ্যাক্সেস করা হচ্ছে।
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-850 flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> ১০০% কমপ্লায়েন্ট (COMPLIANT)
                </div>
              </div>

              {/* Compliance 2: Least Privilege */}
              <div className="bg-[#121727]/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-200">২. ন্যূনতম অধিকার নীতি</span>
                    <Shield className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    প্রতিটি এপিআই কি শুধুমাত্র প্রয়োজনীয় ন্যূনতম গেটওয়ে এবং সার্ভিস এন্ডপয়েন্টে অ্যাক্সেস লাভ করার জন্য সীমাবদ্ধ।
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-850 flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> ১০০% সিকিউর (RESTRICTED KEY)
                </div>
              </div>

              {/* Compliance 3: Rotation Simulator */}
              <div className="bg-[#121727]/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-200">৩. সাময়িক চাবিকাঠি আবর্তন</span>
                    <RefreshCw className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    নিরাপত্তা বৃদ্ধির জন্য নিয়মিত Stripe/FusionPay API Keys রোটেশন বা চক্রাকারে আবর্তন করুন।
                  </p>
                </div>
                
                <div className="mt-4 space-y-2">
                  <div className="text-[9px] font-mono text-slate-450 truncate">
                    সক্রিয় সিক্রেট: <span className="text-indigo-400">{activeSecretHash}</span>
                  </div>
                  <button
                    onClick={handleRotateKey}
                    disabled={isRotating}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 font-bold text-[10px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRotating ? 'animate-spin' : ''}`} />
                    {isRotating ? 'আবর্তন হচ্ছে...' : 'সিক্রেট রোটেশন চালান'}
                  </button>
                </div>
              </div>
            </div>

            {/* Rotation status tracking info block */}
            <div className="bg-[#070A14] border border-slate-850 p-3 rounded-xl flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                সর্বশেষ সিক্রেট আবর্তনের সময়: <strong className="text-slate-200 font-mono">{apiKeyRotationTime}</strong>
              </span>
              <span className="text-[9px] text-slate-500 font-bold">INTEGRITY CHECK PASS</span>
            </div>
          </div>
        )}

        {/* TAB: WEBHOOKS MANAGEMENT */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6 animate-fadeIn text-slate-200">
            {/* Alert info about how webhooks work */}
            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 flex gap-3.5">
              <Zap className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h4 className="text-xs font-bold text-indigo-300">ফিউশন পে রিয়েল-টাইম ওয়েব হুক ইঞ্জিন (Anycast Webhook Delivery Engine)</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  আপনার সিস্টেমে ট্রানজ্যাকশন স্ট্যাটাস পরিবর্তন হওয়া মাত্রই (যেমন: <span className="text-emerald-400 font-semibold font-mono">SUCCESS</span> অথবা <span className="text-red-400 font-semibold font-mono">ROLLBACKED</span>), FusionPay নিবন্ধিত ইউআরএল-এ একটি নিরাপদ <strong className="text-indigo-300">POST</strong> রিকোয়েস্ট পাঠায়। প্রতিটি রিকোয়েস্টে পে-লোড ভ্যালিডেশনের জন্য <code className="text-indigo-400 font-mono">X-FusionPay-Signature</code> হেডার অন্তর্ভুক্ত থাকে।
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Registered URLs and Add form */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Add Webhook Form */}
                <div className="bg-[#121727]/80 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Plus className="h-4 w-4 text-indigo-400" /> নতুন ওয়েব হুক নিবন্ধন করুন
                    </h3>
                  </div>

                  <form onSubmit={handleAddWebhook} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">পেলোড গন্তব্য ইউআরএল (Endpoint URL)</label>
                      <input
                        type="url"
                        placeholder="https://yourserver.com/webhooks/payment"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        required
                        className="w-full bg-[#080B13]/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">নিবন্ধিত ইভেন্টসমূহ (Subscribe to Events)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 bg-[#080B13]/40 border border-slate-850 p-2.5 rounded-xl cursor-pointer select-none hover:border-slate-800 transition-all">
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes('SUCCESS')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEvents(prev => [...prev, 'SUCCESS']);
                              } else {
                                setSelectedEvents(prev => prev.filter(ev => ev !== 'SUCCESS'));
                              }
                            }}
                            className="rounded border-slate-800 text-indigo-650 focus:ring-0 focus:ring-offset-0 bg-[#080B13]"
                          />
                          <span className="text-xs font-mono font-semibold text-emerald-400">SUCCESS</span>
                        </label>

                        <label className="flex items-center gap-2 bg-[#080B13]/40 border border-slate-850 p-2.5 rounded-xl cursor-pointer select-none hover:border-slate-800 transition-all">
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes('ROLLBACKED')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEvents(prev => [...prev, 'ROLLBACKED']);
                              } else {
                                setSelectedEvents(prev => prev.filter(ev => ev !== 'ROLLBACKED'));
                              }
                            }}
                            className="rounded border-slate-800 text-indigo-650 focus:ring-0 focus:ring-offset-0 bg-[#080B13]"
                          />
                          <span className="text-xs font-mono font-semibold text-red-400">ROLLBACKED</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={selectedEvents.length === 0}
                      className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs py-2 px-4 rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" /> ওয়েব হুক যোগ করুন (Register Webhook)
                    </button>
                  </form>
                </div>

                {/* List of webhooks */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">নিবন্ধিত এন্ডপয়েন্ট তালিকা ({webhooks.length})</h3>
                  
                  {webhooks.length === 0 ? (
                    <div className="bg-[#121727]/30 border border-slate-850 rounded-xl p-6 text-center text-slate-550 text-xs">
                      কোনো ওয়েব হুক এন্ডপয়েন্ট নিবন্ধিত নেই।
                    </div>
                  ) : (
                    webhooks.map((wh) => (
                      <div key={wh.id} className="bg-[#121727]/80 border border-slate-800 rounded-xl p-4.5 space-y-3.5 relative">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 overflow-hidden">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold text-slate-100 break-all select-all">{wh.url}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
                                wh.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-500/10 text-slate-400 border border-slate-800'
                              }`}>
                                {wh.status}
                              </span>
                            </div>
                            <div className="text-[9px] text-slate-450">ID: {wh.id} • Registered: {wh.createdTime}</div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleToggleStatus(wh.id)}
                              title={wh.status === 'active' ? 'Disable Webhook' : 'Enable Webhook'}
                              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-all cursor-pointer"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteWebhook(wh.id)}
                              title="Delete Webhook"
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-all cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Secret Key with copy */}
                        <div className="bg-[#080B13]/60 border border-slate-850 p-2 rounded-lg flex items-center justify-between gap-4 text-[10px] font-mono">
                          <span className="text-slate-450 truncate">
                            Signing Secret: <span className="text-indigo-400 select-all font-semibold">{wh.secret}</span>
                          </span>
                          <button
                            onClick={() => copyToClipboard(wh.secret, wh.id)}
                            className="text-[9px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 px-2 py-0.5 rounded font-bold cursor-pointer transition-all shrink-0"
                          >
                            {copiedWhId === wh.id ? 'Copied!' : 'Copy'}
                          </button>
                        </div>

                        {/* Events subscribed & Trigger test */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-850 pt-3">
                          <div className="flex gap-1 items-center flex-wrap">
                            <span className="text-[9px] font-bold text-slate-450 uppercase mr-1">Events:</span>
                            {wh.events.map(ev => (
                              <span key={ev} className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                ev === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {ev}
                              </span>
                            ))}
                          </div>

                          {/* Quick test control */}
                          <div className="flex items-center gap-1.5">
                            <select
                              value={testEventType}
                              onChange={(e) => setTestEventType(e.target.value as any)}
                              className="bg-[#080B13]/90 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 font-mono focus:outline-none"
                            >
                              <option value="SUCCESS">SUCCESS</option>
                              <option value="ROLLBACKED">ROLLBACKED</option>
                            </select>
                            <button
                              onClick={() => handleTestWebhook(wh)}
                              disabled={isTestingWebhook !== null || wh.status === 'inactive'}
                              className="bg-indigo-650/40 hover:bg-indigo-650 text-indigo-300 hover:text-white font-bold text-[10px] py-1 px-2.5 rounded-lg border border-indigo-500/20 transition-all cursor-pointer disabled:opacity-40"
                            >
                              {isTestingWebhook === wh.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin inline mr-1" />
                              ) : (
                                <Play className="h-3 w-3 inline mr-1" />
                              )}
                              টেস্ট পাঠান (Dispatch)
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>

              {/* Right Column: Webhook Delivery logs */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-[#070A14] border border-slate-850 rounded-xl overflow-hidden flex flex-col h-full min-h-[450px]">
                  {/* Ledger Header */}
                  <div className="bg-[#0C101F] px-4 py-3 border-b border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-indigo-400" />
                      <span className="text-xs font-extrabold text-slate-200 tracking-tight font-sans uppercase">
                        ওয়েবহুক ডেলিভারি লেজার (Delivery Log Stream)
                      </span>
                    </div>
                    {webhookLogs.length > 0 && (
                      <button
                        onClick={() => setWebhookLogs([])}
                        className="text-[10px] font-bold text-red-400 hover:text-red-300 cursor-pointer transition-all"
                      >
                        ক্লিয়ার লগ (Clear)
                      </button>
                    )}
                  </div>

                  {/* Ledger Body */}
                  <div className="p-4 font-mono text-[11px] text-slate-300 flex-1 overflow-auto max-h-[500px] space-y-4.5">
                    {webhookLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-20">
                        <Activity className="h-10 w-10 text-slate-700 mb-2" />
                        <span>কোনো ওয়েবহুক ট্রানজ্যাকশন এখনো ট্রিগার করা হয়নি।</span>
                        <span className="text-[10px] text-slate-600 mt-1 max-w-xs">
                          বাম প্যানেলের "টেস্ট পাঠান" বোতামটি ব্যবহার করে রিয়েল-টাইম এন্ডপয়েন্ট বাফারিং ও টেস্ট রিকোয়েস্ট পরীক্ষা করুন।
                        </span>
                      </div>
                    ) : (
                      webhookLogs.map((log) => (
                        <div key={log.id} className="border border-slate-850 bg-slate-900/10 rounded-xl p-3 space-y-3.5">
                          {/* Log Meta Row */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-900">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                  log.event === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {log.event}
                                </span>
                                <span className="text-slate-400 text-[10px] font-semibold break-all">{log.url}</span>
                              </div>
                              <div className="text-[9px] text-slate-500">{log.timestamp} • ID: {log.id}</div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono border ${
                                log.status === 'SUCCESS'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                STATUS: {log.responseCode === 0 ? 'FAIL' : log.responseCode} ({log.responseText})
                              </span>
                            </div>
                          </div>

                          {/* Payload & Header view */}
                          <div className="space-y-3">
                            {/* Generated Headers */}
                            <div className="space-y-1">
                              <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider">HTTP Request Headers</div>
                              <div className="bg-black/30 p-2.5 rounded-lg border border-slate-850/60 text-[10px] text-indigo-300 font-mono space-y-1 overflow-x-auto">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Method:</span>
                                  <span>POST</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Content-Type:</span>
                                  <span>application/json</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">X-FusionPay-Event:</span>
                                  <span>{log.event}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-500">X-FusionPay-Signature:</span>
                                  <span className="truncate select-all text-indigo-400">{log.payload?.webhook_id ? 'whsec_***' : 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            {/* JSON Payload */}
                            <div className="space-y-1">
                              <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider">JSON POST Body Payload</div>
                              <div className="bg-black/40 p-3 rounded-lg border border-slate-850 text-[10px] overflow-x-auto text-emerald-400">
                                <pre className="select-all font-mono whitespace-pre-wrap">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CODE REFERENCE */}
        {activeTab === 'code' && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              নিরাপদ সার্ভার-সাইড এবং ক্যাশিং কোড প্রোটোকল (Core Security Blueprint)
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Stripe Proxy endpoint code layout */}
              <div className="bg-[#070A14] border border-slate-850 rounded-xl overflow-hidden">
                <div className="bg-[#0C101F] px-4 py-2 border-b border-slate-850 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400">server/routes/payment.js (Stripe Route)</span>
                  <span className="text-[9px] text-emerald-400 font-mono">100% Server Side</span>
                </div>
                <div className="p-3 bg-black/40 overflow-x-auto text-[10px] font-mono leading-relaxed text-indigo-200">
                  <pre>{`const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/create-intent', async (req, res) => {
  try {
    const { amount, currency } = req.body;
    // পেমেন্ট ইন্টেন্ট তৈরি হচ্ছে নিরাপদে
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
    });
    res.status(200).json({ 
      clientSecret: paymentIntent.client_secret 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`}</pre>
                </div>
              </div>

              {/* Yapily cache layer code layout */}
              <div className="bg-[#070A14] border border-slate-850 rounded-xl overflow-hidden">
                <div className="bg-[#0C101F] px-4 py-2 border-b border-slate-850 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400">server/services/bankService.js (Yapily Cache)</span>
                  <span className="text-[9px] text-sky-400 font-mono">Caching Layer</span>
                </div>
                <div className="p-3 bg-black/40 overflow-x-auto text-[10px] font-mono leading-relaxed text-indigo-200">
                  <pre>{`const cache = new Map(); // ইন-মেমোরি ক্যাশ বাফার

const getInstitutions = async (countryCode) => {
  // ক্যাশে ইতিমধ্যে থাকলে ডিরেক্ট রিটার্ন
  if (cache.has(countryCode)) {
    return cache.get(countryCode);
  }
  
  const response = await axios.get(
    \`\${YAPILY_BASE_URL}/institutions?country=\${countryCode}\`
  );
  
  // ক্যাশে সেভ রাখা হচ্ছে যাতে ওভারহেড না বাড়ে
  cache.set(countryCode, response.data);
  return response.data;
};`}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
