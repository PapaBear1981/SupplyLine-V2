import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Steps,
  Button,
  Form,
  Input,
  Select,
  Card,
  Row,
  Col,
  Table,
  Space,
  message,
  Typography,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  MinusCircleOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useKitWizardMutation, useGetAircraftTypesQuery } from '../services/kitsApi';
import type { BoxType } from '../types';

const { Option } = Select;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface BoxConfig {
  key: string;
  box_number: string;
  box_type: BoxType;
  description: string;
}

const KitWizard = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<{
    aircraft_type_id?: number;
    name?: string;
    description?: string;
    boxes?: BoxConfig[];
  }>({});

  const { data: aircraftTypes = [] } = useGetAircraftTypesQuery({});
  const [kitWizard, { isLoading }] = useKitWizardMutation();

  const defaultBoxes: BoxConfig[] = [
    { key: '1', box_number: 'Box1', box_type: 'expendable', description: 'Expendable items' },
    { key: '2', box_number: 'Box2', box_type: 'tooling', description: 'Tools' },
    { key: '3', box_number: 'Box3', box_type: 'consumable', description: 'Consumables' },
    { key: '4', box_number: 'Loose', box_type: 'loose', description: 'Loose items in cabinets' },
    { key: '5', box_number: 'Floor', box_type: 'floor', description: 'Large items on floor' },
  ];

  const [boxes, setBoxes] = useState<BoxConfig[]>(defaultBoxes);

  const handleNext = async () => {
    try {
      const values = await form.validateFields();

      if (currentStep === 0) {
        // Step 1: Aircraft type selection
        setWizardData({ ...wizardData, aircraft_type_id: values.aircraft_type_id });
        setCurrentStep(1);
      } else if (currentStep === 1) {
        // Step 2: Kit details validation
        const result = await kitWizard({
          step: 2,
          name: values.name,
          aircraft_type_id: wizardData.aircraft_type_id,
          description: values.description,
        }).unwrap();

        if (result.step === 2 && 'valid' in result && result.valid) {
          setWizardData({
            ...wizardData,
            name: values.name,
            description: values.description,
          });
          setCurrentStep(2);
        }
      } else if (currentStep === 2) {
        // Step 3: Box configuration - move to review
        setWizardData({ ...wizardData, boxes });
        setCurrentStep(3);
      }
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Validation failed');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFinish = async () => {
    try {
      const result = await kitWizard({
        step: 4,
        name: wizardData.name,
        aircraft_type_id: wizardData.aircraft_type_id,
        description: wizardData.description,
        boxes: boxes.map(({ box_number, box_type, description }) => ({
          box_number,
          box_type,
          description,
        })),
      }).unwrap();

      if ('kit' in result && result.kit) {
        message.success('Kit created successfully!');
        navigate(`/kits/${result.kit.id}`);
      }
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to create kit');
    }
  };

  const addBox = () => {
    const newKey = `${Date.now()}`;
    setBoxes([
      ...boxes,
      {
        key: newKey,
        box_number: `Box${boxes.length + 1}`,
        box_type: 'expendable',
        description: '',
      },
    ]);
  };

  const removeBox = (key: string) => {
    setBoxes(boxes.filter((box) => box.key !== key));
  };

  const updateBox = (key: string, field: keyof BoxConfig, value: string) => {
    setBoxes(
      boxes.map((box) =>
        box.key === key ? { ...box, [field]: value } : box
      )
    );
  };

  const boxColumns: ColumnsType<BoxConfig> = [
    {
      title: 'Box Number',
      dataIndex: 'box_number',
      key: 'box_number',
      render: (value: string, record: BoxConfig) => (
        <Input
          value={value}
          onChange={(e) => updateBox(record.key, 'box_number', e.target.value)}
          placeholder="e.g., Box1"
        />
      ),
    },
    {
      title: 'Box Type',
      dataIndex: 'box_type',
      key: 'box_type',
      render: (value: BoxType, record: BoxConfig) => (
        <Select
          value={value}
          onChange={(val) => updateBox(record.key, 'box_type', val)}
          style={{ width: '100%' }}
        >
          <Option value="expendable">Expendable</Option>
          <Option value="tooling">Tooling</Option>
          <Option value="consumable">Consumable</Option>
          <Option value="loose">Loose</Option>
          <Option value="floor">Floor</Option>
        </Select>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (value: string, record: BoxConfig) => (
        <Input
          value={value}
          onChange={(e) => updateBox(record.key, 'description', e.target.value)}
          placeholder="Brief description"
        />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: BoxConfig) => (
        <Button
          type="text"
          danger
          icon={<MinusCircleOutlined />}
          onClick={() => removeBox(record.key)}
        />
      ),
    },
  ];

  const steps = [
    {
      title: 'Aircraft Type',
      content: (
        <Form form={form} layout="vertical">
          <Form.Item
            name="aircraft_type_id"
            label="Select Aircraft Type"
            rules={[{ required: true, message: 'Please select an aircraft type' }]}
            initialValue={wizardData.aircraft_type_id}
          >
            <Select placeholder="Select aircraft type" size="large">
              {aircraftTypes
                .filter((type) => type.is_active)
                .map((type) => (
                  <Option key={type.id} value={type.id}>
                    {type.name} - {type.description}
                  </Option>
                ))}
            </Select>
          </Form.Item>
        </Form>
      ),
    },
    {
      title: 'Kit Details',
      content: (
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Kit Name"
            rules={[{ required: true, message: 'Please enter kit name' }]}
            initialValue={wizardData.name}
          >
            <Input placeholder="Enter unique kit name" size="large" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            initialValue={wizardData.description}
          >
            <TextArea
              rows={4}
              placeholder="Enter kit description (optional)"
            />
          </Form.Item>
        </Form>
      ),
    },
    {
      title: 'Box Configuration',
      content: (
        <div>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Text>
              Configure the boxes that will be in this kit. You can customize the suggested
              boxes or add your own.
            </Text>
            <Table
              columns={boxColumns}
              dataSource={boxes}
              rowKey="key"
              pagination={false}
            />
            <Button type="dashed" onClick={addBox} icon={<PlusOutlined />} block>
              Add Box
            </Button>
          </Space>
        </div>
      ),
    },
    {
      title: 'Review',
      content: (
        <div>
          <Card>
            <Title level={4}>Kit Summary</Title>
            <Divider />
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Text strong>Aircraft Type:</Text>
              </Col>
              <Col span={16}>
                <Text>
                  {aircraftTypes.find((t) => t.id === wizardData.aircraft_type_id)?.name}
                </Text>
              </Col>
              <Col span={8}>
                <Text strong>Kit Name:</Text>
              </Col>
              <Col span={16}>
                <Text>{wizardData.name}</Text>
              </Col>
              <Col span={8}>
                <Text strong>Description:</Text>
              </Col>
              <Col span={16}>
                <Text>{wizardData.description || 'N/A'}</Text>
              </Col>
              <Col span={8}>
                <Text strong>Number of Boxes:</Text>
              </Col>
              <Col span={16}>
                <Text>{boxes.length}</Text>
              </Col>
            </Row>
            <Divider />
            <Title level={5}>Boxes</Title>
            <Table
              columns={[
                { title: 'Box Number', dataIndex: 'box_number', key: 'box_number' },
                {
                  title: 'Type',
                  dataIndex: 'box_type',
                  key: 'box_type',
                  render: (type: BoxType) => type.toUpperCase(),
                },
                { title: 'Description', dataIndex: 'description', key: 'description' },
              ]}
              dataSource={boxes}
              rowKey="key"
              pagination={false}
              size="small"
            />
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/kits')}>
              Back to Kits
            </Button>
            <Title level={2}>Create New Kit</Title>
          </Space>

          <Steps
            current={currentStep}
            items={steps.map((step) => ({ title: step.title }))}
          />

          <div style={{ marginTop: 24 }}>{steps[currentStep].content}</div>

          <div style={{ marginTop: 24 }}>
            <Space>
              {currentStep > 0 && (
                <Button onClick={handlePrevious} disabled={isLoading}>
                  Previous
                </Button>
              )}
              {currentStep < steps.length - 1 && (
                <Button type="primary" onClick={handleNext} loading={isLoading}>
                  Next
                </Button>
              )}
              {currentStep === steps.length - 1 && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleFinish}
                  loading={isLoading}
                >
                  Create Kit
                </Button>
              )}
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default KitWizard;
