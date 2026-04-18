import { useState } from 'react';
import {
  List,
  Tag,
  Button,
  SpinLoading,
  Toast,
  Form,
  Input,
  Selector,
  TextArea,
} from 'antd-mobile';
import { LeftOutline } from 'antd-mobile-icons';
import {
  useGetAnnouncementsQuery,
  useCreateAnnouncementMutation,
  useDeleteAnnouncementMutation,
} from '../../services/adminApi';
import type { Announcement } from '../../types';
import {
  MobilePageScaffold,
  MobileDetailHeader,
  MobileSectionCard,
  MobileEmptyState,
  MobileFormSheet,
  MobileConfirmSheet,
} from '@shared/components/mobile';
import { useHaptics } from '@shared/hooks/useHaptics';
import dayjs from 'dayjs';

interface MobileAnnouncementsListProps {
  onBack?: () => void;
}

interface AnnouncementFormValues {
  title: string;
  message: string;
  priority: ('low' | 'medium' | 'high' | 'urgent')[];
}

const PRIORITY_COLOR: Record<Announcement['priority'], string> = {
  low: '#8c8c8c',
  medium: '#1890ff',
  high: '#faad14',
  urgent: '#ff4d4f',
};

export const MobileAnnouncementsList = ({ onBack }: MobileAnnouncementsListProps) => {
  const haptics = useHaptics();
  const { data: announcements, isLoading } = useGetAnnouncementsQuery();
  const [createAnnouncement, { isLoading: creating }] = useCreateAnnouncementMutation();
  const [deleteAnnouncement, { isLoading: deleting }] = useDeleteAnnouncementMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Announcement | null>(null);
  const [form] = Form.useForm<AnnouncementFormValues>();

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ priority: ['medium'] });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createAnnouncement({
        title: values.title,
        message: values.message,
        priority: values.priority[0],
        is_active: true,
      }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Announcement posted' });
      setCreateOpen(false);
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to post announcement' });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteAnnouncement(deleteConfirm.id).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Announcement deleted' });
      setDeleteConfirm(null);
    } catch {
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to delete announcement' });
    }
  };

  return (
    <MobilePageScaffold
      header={
        <MobileDetailHeader
          title="Announcements"
          subtitle={`${announcements?.length ?? 0} posted`}
          actions={
            <>
              {onBack && (
                <Button size="small" fill="none" onClick={onBack}>
                  <LeftOutline /> Back
                </Button>
              )}
              <Button size="small" color="primary" onClick={openCreate}>
                New
              </Button>
            </>
          }
        />
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <SpinLoading />
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <MobileEmptyState
          title="No announcements"
          description="Create one to send a message to all users."
          actionLabel="New Announcement"
          onAction={openCreate}
        />
      ) : (
        <MobileSectionCard flush>
          <List>
            {announcements.map((a) => (
              <List.Item
                key={a.id}
                description={
                  <div style={{ marginTop: 4 }}>
                    <div style={{ marginBottom: 4 }}>{a.message}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <Tag color={PRIORITY_COLOR[a.priority]} fill="outline">
                        {a.priority}
                      </Tag>
                      {!a.is_active && <Tag fill="outline">Inactive</Tag>}
                      <Tag fill="outline">{dayjs(a.created_at).format('MMM D')}</Tag>
                    </div>
                  </div>
                }
                extra={
                  <Button
                    size="small"
                    color="danger"
                    fill="none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(a);
                    }}
                  >
                    Delete
                  </Button>
                }
              >
                <div style={{ fontWeight: 600 }}>{a.title}</div>
              </List.Item>
            ))}
          </List>
        </MobileSectionCard>
      )}

      <MobileFormSheet
        visible={createOpen}
        title="New Announcement"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        submitting={creating}
        submitLabel="Post"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="Short headline" />
          </Form.Item>
          <Form.Item
            name="message"
            label="Message"
            rules={[{ required: true, message: 'Message is required' }]}
          >
            <TextArea rows={5} placeholder="Announcement body" />
          </Form.Item>
          <Form.Item name="priority" label="Priority">
            <Selector
              multiple={false}
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Urgent', value: 'urgent' },
              ]}
            />
          </Form.Item>
        </Form>
      </MobileFormSheet>

      <MobileConfirmSheet
        visible={!!deleteConfirm}
        title="Delete announcement?"
        description={
          deleteConfirm
            ? `"${deleteConfirm.title}" will be removed for all users.`
            : ''
        }
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirm(null)}
        loading={deleting}
      />
    </MobilePageScaffold>
  );
};
