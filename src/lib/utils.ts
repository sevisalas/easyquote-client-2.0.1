import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda EUR con separador de miles (punto) y decimales (coma).
 * Ejemplo: 1110 → "1.110,00 €", 25000.5 → "25.000,50 €"
 */
export function fmtEUR(amount: number | string | null | undefined): string {
  const num = typeof amount === 'number'
    ? amount
    : parseFloat(String(amount ?? '0').replace(/\./g, '').replace(',', '.')) || 0;
  const parts = Math.abs(num).toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = num < 0 ? '-' : '';
  return `${sign}${intPart},${parts[1]} €`;
}
