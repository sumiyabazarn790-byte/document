function Footer({ roomName, wsUrl, users }) {
  return (
    <footer className="footer">
      <div>Room: {roomName}</div>
      <div>WebSocket: {wsUrl}</div>
      <div className="presence">
        {users.map((u, index) => (
          <span
            key={`${u?.name || 'user'}-${index}`}
            className="presence-dot"
            title={u?.name}
            style={{ background: u?.color || '#999' }}
          />
        ))}
        <span>{users.length} active</span>
      </div>
    </footer>
  );
}

export default Footer;
