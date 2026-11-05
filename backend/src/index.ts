import app from './app';
import { startWebinarReminders } from './services/webinarReminders.service';

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Iceberg X OS Server is running on port ${PORT}`);
  startWebinarReminders();
});
