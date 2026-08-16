// Conexão única com o SQLite local, compartilhada por todos os repositórios.
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('agenda-app.db');
