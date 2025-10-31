-- Insert Reprotel sales accounts
INSERT INTO public.holded_sales_accounts (organization_id, holded_account_id, name, color, account_num)
VALUES 
  ('cae1d80f-fb8e-4101-bed8-d721d5bb8729', '5b88600ebfcd41285a3a7c29', 'VENTAS 1', '#6486f6', 70000001),
  ('cae1d80f-fb8e-4101-bed8-d721d5bb8729', '6904f1dc2bd803566106fd60', 'VENTAS 2', '#d91cc3', 70000009),
  ('cae1d80f-fb8e-4101-bed8-d721d5bb8729', '6904f1fef2389ec60e0fafd8', 'VENTAS 3', '#20ee1f', 70000010)
ON CONFLICT (organization_id, holded_account_id) DO NOTHING;