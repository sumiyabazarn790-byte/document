import { useI18n } from '../i18n/i18n';

function Footer({ roomName, wsUrl, users }) {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div>{t('footer_room', { room: roomName })}</div>
      <div>{t('footer_ws', { ws: wsUrl })}</div>
      <div className="presence">
        {users.map((u, index) => (
          <span
            key={`${u?.name || 'user'}-${index}`}
            className="presence-dot"
            title={u?.name}
            style={{ background: u?.color || '#999' }}
          />
        ))}
        <span>{t('footer_active', { count: users.length })}</span>
      </div>
    </footer>
  );
}

export default Footer;
