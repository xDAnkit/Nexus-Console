import type { ButtonHTMLAttributes } from 'react';
import type { ButtonVariants } from './Button.styles';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {}
