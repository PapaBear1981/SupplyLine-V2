import { motion } from 'framer-motion';
import { Input, Form } from 'antd';
import type { InputProps } from 'antd';
import type { Rule } from 'antd/es/form';
import { inputVariants } from '../../styles/animations';
import './AnimatedInput.css';

interface AnimatedInputProps extends InputProps {
  name: string;
  label?: string;
  rules?: Rule[];
  icon?: React.ReactNode;
  'data-testid'?: string;
}

export const AnimatedInput = ({
  name,
  label,
  rules,
  icon,
  type = 'text',
  'data-testid': dataTestId,
  ...inputProps
}: AnimatedInputProps) => {
  const InputComponent = type === 'password' ? Input.Password : Input;

  return (
    <motion.div variants={inputVariants} className="animated-input-wrapper">
      <Form.Item label={label} name={name} rules={rules}>
        <InputComponent
          {...inputProps}
          prefix={icon}
          className="glass-input animated-input"
          autoComplete={type === 'password' ? 'current-password' : 'off'}
          data-testid={dataTestId}
        />
      </Form.Item>
    </motion.div>
  );
};
