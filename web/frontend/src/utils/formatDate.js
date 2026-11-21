
export default function formatDate(value) {
  if (!value) return '-';

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'Asia/Jakarta',
      });
}

export const formatTime = (value) => {
  if (!value) return '';

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
      });
};
