export const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-NG");

export const formatMoney = (value) =>
  `₦${formatNumber(value)}`;
