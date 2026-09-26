import "./BackupCenter.css";

import {
  Download,
  Upload,
  DatabaseBackup,
  Clock3,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import BusinessGate from "../Business/BusinessGate";

const BACKUP_KEY = "uptrend_backup_history";

const DATA_KEYS = {
  products: "uptrend_products",
  sales: "uptrend_sales",
  expenses: "uptrend_expenses",
  finance: "uptrend_finance",
};

function readData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);

    return saved
      ? JSON.parse(saved)
      : fallback;
  } catch {
    return fallback;
  }
}

function createBackup() {
  return {
    app: "UpTrend",
    type: "full-backup",
    version: 1,
    createdAt: new Date().toISOString(),

    data: {
      products: readData(DATA_KEYS.products, []),
      sales: readData(DATA_KEYS.sales, []),
      expenses: readData(DATA_KEYS.expenses, []),
      finance: readData(
        DATA_KEYS.finance,
        {
          openingBalance: 0,
        }
      ),
    },
  };
}

function getBackupHistory() {
  try {
    const saved =
      localStorage.getItem(BACKUP_KEY);

    return saved
      ? JSON.parse(saved)
      : [];
  } catch {
    return [];
  }
}

function saveBackupHistory(history) {
  localStorage.setItem(
    BACKUP_KEY,
    JSON.stringify(history)
  );
}

function formatDate(value) {
  if (!value) {
    return "No backup yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function downloadBackupFile(backup) {
  const blob = new Blob(
    [
      JSON.stringify(
        backup,
        null,
        2
      ),
    ],
    {
      type: "application/json",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  const stamp =
    backup.createdAt
      .replace(/[:.]/g, "-");

  link.href = url;
  link.download =
    `uptrend-backup-${stamp}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function BackupContent() {
  const history = getBackupHistory();

  const latest =
    history.length > 0
      ? history[0]
      : null;

  const handleBackup = () => {
    const backup =
      createBackup();

    const updatedHistory = [
      {
        id: backup.createdAt,
        createdAt:
          backup.createdAt,
        type:
          backup.type,
      },
      ...getBackupHistory(),
    ].slice(0, 10);

    saveBackupHistory(
      updatedHistory
    );

    downloadBackupFile(
      backup
    );
  };

  const handleRestoreFile = (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const confirmed =
      window.confirm(
        "Restoring this backup will replace your current UpTrend data. Continue?"
      );

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      try {
        const backup =
          JSON.parse(
            reader.result
          );

        if (
          backup?.app !==
            "UpTrend" ||
          !backup?.data
        ) {
          throw new Error(
            "Invalid UpTrend backup."
          );
        }

        const {
          products = [],
          sales = [],
          expenses = [],
          finance = {
            openingBalance: 0,
          },
        } =
          backup.data;

        localStorage.setItem(
          DATA_KEYS.products,
          JSON.stringify(
            products
          )
        );

        localStorage.setItem(
          DATA_KEYS.sales,
          JSON.stringify(
            sales
          )
        );

        localStorage.setItem(
          DATA_KEYS.expenses,
          JSON.stringify(
            expenses
          )
        );

        localStorage.setItem(
          DATA_KEYS.finance,
          JSON.stringify(
            finance
          )
        );

        window.alert(
          "Backup restored successfully. UpTrend will now reload."
        );

        window.location.reload();
      } catch (error) {
        console.error(
          "Backup restore failed:",
          error
        );

        window.alert(
          "This file is not a valid UpTrend backup."
        );
      }
    };

    reader.readAsText(file);

    event.target.value = "";
  };

  return (
    <div className="backup-center">

      <div className="backup-center-hero">

        <div className="backup-center-icon">
          <DatabaseBackup
            size={24}
          />
        </div>

        <div>
          <span className="backup-center-eyebrow">
            BUSINESS DATA PROTECTION
          </span>

          <h3>
            Automated Backups
          </h3>

          <p>
            Keep a safe copy of your
            UpTrend business data and
            restore it whenever you need
            to.
          </p>
        </div>

      </div>

      <div className="backup-center-status">

        <div className="backup-status-icon">
          <ShieldCheck
            size={20}
          />
        </div>

        <div>
          <span>
            LAST BACKUP
          </span>

          <strong>
            {formatDate(
              latest?.createdAt
            )}
          </strong>
        </div>

      </div>

      <div className="backup-center-actions">

        <div className="backup-action-card">

          <div className="backup-action-icon">
            <DatabaseBackup
              size={21}
            />
          </div>

          <div className="backup-action-copy">

            <strong>
              Create a backup
            </strong>

            <p>
              Save your current products,
              sales, expenses and finance
              data into a backup file.
            </p>

          </div>

          <button
            type="button"
            className="backup-primary-button"
            onClick={
              handleBackup
            }
          >
            <Download
              size={17}
            />
            Backup Now
          </button>

        </div>

        <div className="backup-action-card">

          <div className="backup-action-icon">
            <Upload
              size={21}
            />
          </div>

          <div className="backup-action-copy">

            <strong>
              Restore a backup
            </strong>

            <p>
              Restore UpTrend from a
              previously downloaded backup
              file.
            </p>

          </div>

          <label className="backup-secondary-button">

            <Upload
              size={17}
            />

            Restore

            <input
              type="file"
              accept=".json,application/json"
              onChange={
                handleRestoreFile
              }
              hidden
            />

          </label>

        </div>

      </div>

      <div className="backup-included">

        <div className="backup-section-heading">

          <span>
            BACKUP CONTENT
          </span>

          <h4>
            What is protected
          </h4>

        </div>

        <div className="backup-data-grid">

          <div>
            <span>✓</span>
            <strong>
              Products & inventory
            </strong>
          </div>

          <div>
            <span>✓</span>
            <strong>
              Sales records
            </strong>
          </div>

          <div>
            <span>✓</span>
            <strong>
              Expenses
            </strong>
          </div>

          <div>
            <span>✓</span>
            <strong>
              Finance data
            </strong>
          </div>

        </div>

      </div>

      <div className="backup-warning">

        <AlertTriangle
          size={18}
        />

        <p>
          Keep downloaded backup files
          somewhere safe. Restoring a
          backup replaces the current
          business data on this device.
        </p>

      </div>

      {history.length > 0 && (
        <div className="backup-history">

          <div className="backup-section-heading">

            <span>
              BACKUP HISTORY
            </span>

            <h4>
              Recent backups
            </h4>

          </div>

          {history.map(
            (item) => (
              <div
                className="backup-history-item"
                key={item.id}
              >

                <div className="backup-history-icon">
                  <Clock3
                    size={17}
                  />
                </div>

                <div>
                  <strong>
                    Full UpTrend backup
                  </strong>

                  <span>
                    {formatDate(
                      item.createdAt
                    )}
                  </span>
                </div>

              </div>
            )
          )}

        </div>
      )}

    </div>
  );
}

function BackupCenter({
  subscription,
  onUpgrade,
}) {
  return (
    <BusinessGate
      subscription={
        subscription
      }
      title="Automated Backups"
      description="Protect your UpTrend business data with backup and restore tools available to Business subscribers."
      onUpgrade={
        onUpgrade
      }
    >
      <BackupContent />
    </BusinessGate>
  );
}

export default BackupCenter;
