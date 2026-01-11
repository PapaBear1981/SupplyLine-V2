import { useState } from 'react';
import { Alert, Button, Checkbox, Space, Typography, Card, Row, Col, message } from 'antd';
import {
  CopyOutlined,
  DownloadOutlined,
  PrinterOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import './BackupCodesDisplay.css';

const { Title, Text, Paragraph } = Typography;

interface BackupCodesDisplayProps {
  codes: string[];
  generatedAt: string;
  onConfirm: () => void;
}

export const BackupCodesDisplay = ({
  codes,
  generatedAt,
  onConfirm,
}: BackupCodesDisplayProps) => {
  const [confirmSaved, setConfirmSaved] = useState(false);
  const [confirmUnderstand, setConfirmUnderstand] = useState(false);

  const handleCopyAll = () => {
    const text = codes.join('\n');
    navigator.clipboard.writeText(text);
    message.success('Backup codes copied to clipboard');
  };

  const handleDownload = () => {
    const text = `SupplyLine Backup Codes
Generated: ${new Date(generatedAt).toLocaleString()}

These are your one-time use backup codes. Keep them safe.

${codes.map((code, idx) => `${idx + 1}. ${code}`).join('\n')}

IMPORTANT:
- Each code can only be used once
- Store these codes in a secure location
- Do not share these codes with anyone
- Generate new codes if these are lost or compromised
`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplyline-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success('Backup codes downloaded');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=600,height=800');
    if (!printWindow) {
      message.error('Please allow popups to print backup codes');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>SupplyLine Backup Codes</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              padding: 40px;
              max-width: 600px;
              margin: 0 auto;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 10px;
            }
            .meta {
              color: #666;
              margin-bottom: 30px;
            }
            .codes {
              border: 2px solid #333;
              padding: 20px;
              background: #f5f5f5;
            }
            .code-item {
              font-size: 18px;
              margin: 10px 0;
              font-weight: bold;
            }
            .warning {
              margin-top: 30px;
              padding: 15px;
              background: #fff3cd;
              border-left: 4px solid #ff9800;
            }
            .warning h3 {
              margin-top: 0;
              color: #ff9800;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <h1>SupplyLine Backup Codes</h1>
          <div class="meta">
            Generated: ${new Date(generatedAt).toLocaleString()}<br/>
            Employee: Confidential
          </div>
          <div class="codes">
            ${codes.map((code, idx) => `
              <div class="code-item">${idx + 1}. ${code}</div>
            `).join('')}
          </div>
          <div class="warning">
            <h3>⚠️ IMPORTANT SECURITY NOTICE</h3>
            <ul>
              <li>Each code can only be used <strong>once</strong></li>
              <li>Store these codes in a <strong>secure location</strong></li>
              <li>Do not share these codes with anyone</li>
              <li>Generate new codes if these are lost or compromised</li>
            </ul>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
    message.success('Print dialog opened');
  };

  const canConfirm = confirmSaved && confirmUnderstand;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="backup-codes-display"
    >
      <Alert
        message="Save Your Backup Codes"
        description="These codes will only be shown once. Make sure to save them securely."
        type="warning"
        icon={<WarningOutlined />}
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card className="backup-codes-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>Your Backup Codes</Title>
            <Text type="secondary">
              Use these codes to access your account if you lose access to your authenticator app.
              Each code can only be used once.
            </Text>
          </div>

          <div className="codes-grid">
            <Row gutter={[16, 16]}>
              {codes.map((code, idx) => (
                <Col xs={24} sm={12} key={idx}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="code-item"
                  >
                    <span className="code-number">{idx + 1}.</span>
                    <span className="code-value">{code}</span>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </div>

          <Space wrap>
            <Button icon={<CopyOutlined />} onClick={handleCopyAll}>
              Copy All
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleDownload}>
              Download
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Print
            </Button>
          </Space>

          <Alert
            message="Store these codes securely"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>Save them in a password manager</li>
                <li>Print and store in a secure location</li>
                <li>Never share them with anyone</li>
                <li>Generate new codes if compromised</li>
              </ul>
            }
            type="info"
            showIcon
          />

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Checkbox checked={confirmSaved} onChange={(e) => setConfirmSaved(e.target.checked)}>
              I have saved these backup codes in a secure location
            </Checkbox>
            <Checkbox
              checked={confirmUnderstand}
              onChange={(e) => setConfirmUnderstand(e.target.checked)}
            >
              I understand that these codes will not be shown again
            </Checkbox>
          </Space>

          <Button
            type="primary"
            size="large"
            block
            disabled={!canConfirm}
            icon={<CheckCircleOutlined />}
            onClick={onConfirm}
          >
            I've Saved My Backup Codes
          </Button>
        </Space>
      </Card>
    </motion.div>
  );
};
