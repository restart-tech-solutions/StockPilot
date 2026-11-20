import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SalesRevenueChartProps {
  data: Array<{
    _id: string;
    salesRevenue: number;
    quantity: number;
  }>;
  currency: string;
  showTooltipDate?: boolean;
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function SalesRevenueChart({
  data,
  currency,
  showTooltipDate = false,
}: SalesRevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="_id"
          tickFormatter={(value: string) =>
            new Date(value).toLocaleDateString()
          }
        />
        <YAxis />
        <Tooltip
          labelFormatter={
            showTooltipDate
              ? (value) => new Date(String(value)).toLocaleDateString()
              : undefined
          }
          formatter={(value) => [
            formatMoney(Number(value), currency),
            "Sales revenue",
          ]}
        />
        <Line
          type="monotone"
          dataKey="salesRevenue"
          name="Sales revenue"
          stroke="#1D4ED8"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
