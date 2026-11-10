package io.zerogex.bookmap.ui;

import io.zerogex.bookmap.Settings;
import io.zerogex.bookmap.core.LevelKind;
import io.zerogex.bookmap.core.StatusText;
import io.zerogex.bookmap.core.SymbolResolver;
import java.awt.Color;
import java.awt.Component;
import java.awt.Desktop;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.Toolkit;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.StringSelection;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.awt.event.HierarchyEvent;
import java.awt.event.HierarchyListener;
import java.net.URI;
import javax.swing.BorderFactory;
import javax.swing.Icon;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JColorChooser;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JSpinner;
import javax.swing.SpinnerNumberModel;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import velox.gui.StrategyPanel;

/**
 * The add-on's settings, as four panels in Bookmap's settings dialog.
 *
 * <p>Every change applies the moment it is made and is saved with the
 * workspace: there is no OK button whose absence leaves a chart half-set-up.
 * The API key is the exception that proves the rule: it is saved when the
 * trader presses Save (or Enter, or leaves the field), because a half-pasted
 * key should not be sent anywhere.
 *
 * <p>The connection panel shows the chart's live status, refreshed every
 * second while the dialog is open, in the same words as the chart badge.
 */
public final class SettingsPanels {

    static final String KEY_URL = "https://zerogex.io/account#api-access";
    static final String GUIDE_URL = "https://zerogex.io/bookmap-indicator";

    private static final String[] LINE_WEIGHTS = {"Thin", "Normal", "Thick"};
    private static final String[] LABEL_SIZES = {"Small", "Normal", "Large", "Extra large"};
    private static final String[] BADGE_POSITIONS = {"Bottom left", "Top left"};
    private static final String[] PROFILE_SIDES = {"Left edge", "Right edge (beside the labels)"};
    private static final String[] EXPIRATIONS = {"All expirations", "0DTE only (no history backfill)"};

    private SettingsPanels() {
    }

    public static StrategyPanel[] build(AddonControl control) {
        return new StrategyPanel[] {
            connection(control), levels(control), profile(control), alerts(control)
        };
    }

    // ------------------------------------------------------------------
    // Connection
    // ------------------------------------------------------------------

    static StrategyPanel connection(final AddonControl control) {
        final StrategyPanel panel = new StrategyPanel("ZeroGEX connection", new GridBagLayout());
        Rows rows = new Rows(panel);

        final JPasswordField key = new JPasswordField(28);
        final char echo = key.getEchoChar();
        final JLabel keyNote = note(control.hasApiKey()
                ? "A key is saved. Paste a new one to replace it."
                : "Paste your key from zerogex.io, Account > API Access (included with Pro).");
        final JCheckBox show = new JCheckBox("Show");
        show.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                key.setEchoChar(show.isSelected() ? (char) 0 : echo);
            }
        });
        final JButton save = new JButton("Save key");
        final Runnable doSave = new Runnable() {
            @Override
            public void run() {
                String typed = new String(key.getPassword()).trim();
                if (typed.isEmpty()) {
                    return;
                }
                keyNote.setText(control.saveApiKey(typed));
                key.setText("");
            }
        };
        save.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                doSave.run();
            }
        });
        key.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                doSave.run();
            }
        });
        key.addFocusListener(new FocusAdapter() {
            @Override
            public void focusLost(FocusEvent e) {
                doSave.run();
            }
        });
        JButton paste = new JButton("Paste");
        paste.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                try {
                    Object clip = Toolkit.getDefaultToolkit().getSystemClipboard().getData(DataFlavor.stringFlavor);
                    if (clip instanceof String) {
                        key.setText(((String) clip).trim());
                        doSave.run();
                    }
                } catch (Exception ex) {
                    keyNote.setText("Nothing to paste - copy the key first");
                }
            }
        });
        rows.add("API key", inline(key, paste, save, show));
        rows.add("", inline(keyNote, link("Get your key", KEY_URL)));

        Settings s = control.settings();
        final JComboBox<String> symbol = new JComboBox<String>();
        symbol.addItem(control.detectedSymbolText());
        for (String sym : SymbolResolver.KNOWN_SYMBOLS) {
            symbol.addItem(sym);
        }
        symbol.setEditable(true);
        symbol.setSelectedIndex(0);
        if (!Settings.AUTO.equals(s.symbol)) {
            symbol.setSelectedItem(s.symbol);
        }
        symbol.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Object picked = symbol.getSelectedItem();
                String value = picked == null ? "" : picked.toString().trim();
                Settings next = control.settings();
                next.symbol = symbol.getSelectedIndex() == 0 || value.isEmpty() || value.startsWith("Auto")
                        ? Settings.AUTO : value.toUpperCase(java.util.Locale.ROOT);
                control.applySettings(next);
            }
        });
        rows.add("Symbol", symbol);
        rows.add("", note("Auto reads the chart: MES and MNQ use the ES and NQ levels. Pick one to override."));

        final JComboBox<String> expiration = new JComboBox<String>(EXPIRATIONS);
        expiration.setSelectedIndex("0dte".equals(s.expiration) ? 1 : 0);
        expiration.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.expiration = expiration.getSelectedIndex() == 1 ? "0dte" : "all";
                control.applySettings(next);
            }
        });
        rows.add("Expiration", expiration);

        final JLabel status = new JLabel(" ");
        rows.add("Status", status);
        final JLabel result = note(" ");
        JButton test = new JButton("Test connection");
        test.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                result.setText("Testing...");
                control.testConnection(new java.util.function.Consumer<String>() {
                    @Override
                    public void accept(final String text) {
                        SwingUtilities.invokeLater(new Runnable() {
                            @Override
                            public void run() {
                                result.setText(text);
                            }
                        });
                    }
                });
            }
        });
        JButton copy = new JButton("Copy diagnostics");
        copy.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                try {
                    Toolkit.getDefaultToolkit().getSystemClipboard()
                            .setContents(new StringSelection(control.diagnostics()), null);
                    result.setText("Copied. Paste it into an email to support@zerogex.io");
                } catch (Exception ex) {
                    result.setText("Could not reach the clipboard");
                }
            }
        });
        rows.add("", inline(test, copy, link("Setup guide", GUIDE_URL)));
        rows.add("", result);
        rows.add("", note("v" + control.version() + ". For informational and educational purposes only."
                + " Not financial advice."));

        final Timer timer = new Timer(1000, new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                refreshStatus(control, status);
            }
        });
        refreshStatus(control, status);
        runWhileShowing(panel, timer);
        return panel;
    }

    static void refreshStatus(AddonControl control, JLabel status) {
        status.setText(control.statusLine());
        StatusText.Tone tone = control.statusTone();
        status.setForeground(tone == StatusText.Tone.BAD ? new Color(0xE5484D)
                : tone == StatusText.Tone.WARN ? new Color(0xD99A1E)
                : tone == StatusText.Tone.GOOD ? new Color(0x2EA66B)
                : UIColors.text());
    }

    // ------------------------------------------------------------------
    // Levels
    // ------------------------------------------------------------------

    static StrategyPanel levels(final AddonControl control) {
        StrategyPanel panel = new StrategyPanel("Levels on the chart", new GridBagLayout());
        Rows rows = new Rows(panel);
        Settings s = control.settings();
        for (final LevelKind kind : LevelKind.values()) {
            final JCheckBox on = new JCheckBox(kind.displayName, s.showLevel[kind.ordinal()]);
            on.addActionListener(new ActionListener() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    Settings next = control.settings();
                    next.showLevel[kind.ordinal()] = on.isSelected();
                    control.applySettings(next);
                }
            });
            final ColorButton color = new ColorButton(new Color(s.levelColor[kind.ordinal()]));
            color.addActionListener(new ActionListener() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    Color picked = JColorChooser.showDialog(color, kind.displayName + " color", color.color);
                    if (picked != null) {
                        color.setColor(picked);
                        Settings next = control.settings();
                        next.levelColor[kind.ordinal()] = picked.getRGB() & 0xFFFFFF;
                        control.applySettings(next);
                    }
                }
            });
            JButton reset = new JButton("Default");
            reset.setMargin(new Insets(1, 6, 1, 6));
            reset.addActionListener(new ActionListener() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    color.setColor(new Color(kind.defaultRgb));
                    Settings next = control.settings();
                    next.levelColor[kind.ordinal()] = kind.defaultRgb;
                    control.applySettings(next);
                }
            });
            rows.add("", inline(on, color, reset));
        }

        final JComboBox<String> weight = new JComboBox<String>(LINE_WEIGHTS);
        weight.setSelectedIndex(s.lineWeight);
        weight.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.lineWeight = weight.getSelectedIndex();
                control.applySettings(next);
            }
        });
        rows.add("Line weight", weight);

        final JCheckBox labels = new JCheckBox("Labels at the right edge", s.labels);
        final JComboBox<String> size = new JComboBox<String>(LABEL_SIZES);
        size.setSelectedIndex(s.labelSize);
        labels.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.labels = labels.isSelected();
                control.applySettings(next);
            }
        });
        size.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.labelSize = size.getSelectedIndex();
                control.applySettings(next);
            }
        });
        rows.add("", inline(labels, new JLabel("Size"), size));

        final JCheckBox badge = new JCheckBox("Status badge", s.statusBadge);
        final JComboBox<String> where = new JComboBox<String>(BADGE_POSITIONS);
        where.setSelectedIndex(s.statusBadgeBottom ? 0 : 1);
        badge.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.statusBadge = badge.isSelected();
                control.applySettings(next);
            }
        });
        where.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.statusBadgeBottom = where.getSelectedIndex() == 0;
                control.applySettings(next);
            }
        });
        rows.add("", inline(badge, new JLabel("Position"), where));
        rows.add("", note("Off-screen levels show as markers at the top or bottom edge, with their distance."));
        if (!control.overlayNote().isEmpty()) {
            rows.add("", warn(control.overlayNote()));
        }
        return panel;
    }

    // ------------------------------------------------------------------
    // Profile
    // ------------------------------------------------------------------

    static StrategyPanel profile(final AddonControl control) {
        StrategyPanel panel = new StrategyPanel("Gamma profile", new GridBagLayout());
        Rows rows = new Rows(panel);
        Settings s = control.settings();
        final JCheckBox on = new JCheckBox("Show the per-strike gamma profile", s.profile);
        on.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.profile = on.isSelected();
                control.applySettings(next);
            }
        });
        rows.add("", on);
        final JComboBox<String> side = new JComboBox<String>(PROFILE_SIDES);
        side.setSelectedIndex(s.profileOnRight ? 1 : 0);
        side.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.profileOnRight = side.getSelectedIndex() == 1;
                control.applySettings(next);
            }
        });
        rows.add("Side", side);
        final JSpinner width = new JSpinner(new SpinnerNumberModel(s.profileWidthPct, 5, 40, 1));
        width.addChangeListener(new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                Settings next = control.settings();
                next.profileWidthPct = (Integer) width.getValue();
                control.applySettings(next);
            }
        });
        final JSpinner strikes = new JSpinner(new SpinnerNumberModel(s.profileStrikes, 20, 200, 10));
        strikes.addChangeListener(new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                Settings next = control.settings();
                next.profileStrikes = (Integer) strikes.getValue();
                control.applySettings(next);
            }
        });
        rows.add("Width", inline(width, new JLabel("% of the chart"), new JLabel("   Strikes"), strikes));
        rows.add("", note("Gold: dealers long gamma, hedging leans against moves (a brake)."));
        rows.add("", note("Violet: dealers short gamma, hedging adds to moves (an accelerant)."));
        rows.add("", note("Shows the current book, so it is hidden while replaying an earlier time."));
        return panel;
    }

    // ------------------------------------------------------------------
    // Alerts
    // ------------------------------------------------------------------

    static StrategyPanel alerts(final AddonControl control) {
        StrategyPanel panel = new StrategyPanel("Alerts", new GridBagLayout());
        Rows rows = new Rows(panel);
        Settings s = control.settings();
        final JCheckBox on = new JCheckBox("Alert when price comes within", s.alerts);
        final JSpinner ticks = new JSpinner(new SpinnerNumberModel(s.alertTicks, 0, 40, 1));
        on.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.alerts = on.isSelected();
                control.applySettings(next);
            }
        });
        ticks.addChangeListener(new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                Settings next = control.settings();
                next.alertTicks = (Integer) ticks.getValue();
                control.applySettings(next);
            }
        });
        rows.add("", inline(on, ticks, new JLabel("ticks of:")));
        JPanel kinds = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        kinds.setOpaque(false);
        for (final LevelKind kind : LevelKind.values()) {
            final JCheckBox k = new JCheckBox(kind.displayName, s.alertLevel[kind.ordinal()]);
            k.addActionListener(new ActionListener() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    Settings next = control.settings();
                    next.alertLevel[kind.ordinal()] = k.isSelected();
                    control.applySettings(next);
                }
            });
            kinds.add(k);
        }
        rows.add("", kinds);
        final JCheckBox popup = new JCheckBox("Popup", s.alertPopup);
        final JCheckBox sound = new JCheckBox("Spoken alert", s.alertSound);
        popup.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.alertPopup = popup.isSelected();
                control.applySettings(next);
            }
        });
        sound.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Settings next = control.settings();
                next.alertSound = sound.isSelected();
                control.applySettings(next);
            }
        });
        rows.add("", inline(popup, sound));
        rows.add("", note("Each level alerts once, then again only after price has moved clearly away."));
        if (!control.alertNote().isEmpty()) {
            rows.add("", warn(control.alertNote()));
        }
        return panel;
    }

    // ------------------------------------------------------------------
    // Small pieces
    // ------------------------------------------------------------------

    /** A two-column form: label on the left, control on the right. */
    static final class Rows {
        private final JPanel panel;
        private int row;

        Rows(JPanel panel) {
            this.panel = panel;
        }

        void add(String label, JComponent component) {
            GridBagConstraints c = new GridBagConstraints();
            c.gridy = row;
            c.gridx = 0;
            c.anchor = GridBagConstraints.WEST;
            c.insets = new Insets(3, 6, 3, 8);
            panel.add(new JLabel(label), c);
            c.gridx = 1;
            c.weightx = 1;
            c.fill = GridBagConstraints.NONE;
            c.insets = new Insets(3, 0, 3, 6);
            panel.add(component, c);
            row++;
        }
    }

    static JPanel inline(Component... parts) {
        JPanel p = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        p.setOpaque(false);
        for (Component c : parts) {
            p.add(c);
        }
        return p;
    }

    static JLabel note(String text) {
        JLabel l = new JLabel(text);
        l.setFont(l.getFont().deriveFont(Font.PLAIN, Math.max(10f, l.getFont().getSize2D() - 1f)));
        l.setForeground(UIColors.muted());
        return l;
    }

    static JLabel warn(String text) {
        JLabel l = note(text);
        l.setForeground(new Color(0xD99A1E));
        return l;
    }

    static JButton link(String text, final String url) {
        JButton b = new JButton(text);
        b.setBorderPainted(false);
        b.setContentAreaFilled(false);
        b.setForeground(new Color(0x3B82F6));
        b.setMargin(new Insets(0, 2, 0, 2));
        b.setToolTipText(url);
        b.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                try {
                    if (Desktop.isDesktopSupported()) {
                        Desktop.getDesktop().browse(new URI(url));
                        return;
                    }
                } catch (Exception ignored) {
                    // fall through: copy instead
                }
                Toolkit.getDefaultToolkit().getSystemClipboard().setContents(new StringSelection(url), null);
            }
        });
        return b;
    }

    /** Starts the timer while the panel is on screen and stops it when the dialog closes. */
    static void runWhileShowing(final JComponent panel, final Timer timer) {
        panel.addHierarchyListener(new HierarchyListener() {
            @Override
            public void hierarchyChanged(HierarchyEvent e) {
                if ((e.getChangeFlags() & HierarchyEvent.SHOWING_CHANGED) != 0) {
                    if (panel.isShowing()) {
                        timer.start();
                    } else {
                        timer.stop();
                    }
                }
            }
        });
    }

    /** A square color swatch that opens a color chooser. */
    static final class ColorButton extends JButton {
        private static final long serialVersionUID = 1L;
        Color color;

        ColorButton(Color initial) {
            this.color = initial;
            setPreferredSize(new Dimension(34, 22));
            setIcon(new Icon() {
                @Override
                public void paintIcon(Component c, Graphics g, int x, int y) {
                    g.setColor(color);
                    g.fillRect(x, y, 18, 12);
                    g.setColor(Color.DARK_GRAY);
                    g.drawRect(x, y, 18, 12);
                }

                @Override
                public int getIconWidth() {
                    return 19;
                }

                @Override
                public int getIconHeight() {
                    return 13;
                }
            });
            setToolTipText("Pick a color");
            setBorder(BorderFactory.createEmptyBorder(2, 4, 2, 4));
        }

        void setColor(Color c) {
            this.color = c;
            repaint();
        }
    }

    /** Text colors that read on Bookmap's dark theme and on a light one. */
    static final class UIColors {
        static Color text() {
            Color fg = new JLabel().getForeground();
            return fg == null ? Color.LIGHT_GRAY : fg;
        }

        static Color muted() {
            Color fg = text();
            int avg = (fg.getRed() + fg.getGreen() + fg.getBlue()) / 3;
            return avg > 128 ? new Color(0x9AA4B2) : new Color(0x6B7280);
        }
    }
}
