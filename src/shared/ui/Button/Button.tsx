import { cn } from '@/shared/lib/cn';
import { buttonStyles } from './Button.styles';
import type { ButtonProps } from './Button.types';

export const Button = ({ variant, size, className, type = 'button', ...rest }: ButtonProps) => (
  <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...rest} />
);
