package io.zerogex.bookmap.harness;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.simplified.Api;

/**
 * Bookmap's side of the simplified API, as far as the add-on can see it:
 * indicator registration, settings, and the user-message channel through which
 * the overlay and the alerts register. Built from proxies of Bookmap's own
 * interfaces, so a method the add-on calls that the real Api lacks would fail
 * here the way it would fail in Bookmap.
 */
public final class FakeBookmap {

    public final Map<String, FakeIndicator> indicators = new ConcurrentHashMap<String, FakeIndicator>();
    public final List<Object> messages = Collections.synchronizedList(new ArrayList<Object>());
    public volatile Object settings;
    public final Layer1ApiProvider provider;
    public final Api api;

    public FakeBookmap(Object initialSettings) {
        this.settings = initialSettings;
        this.provider = (Layer1ApiProvider) Proxy.newProxyInstance(FakeBookmap.class.getClassLoader(),
                new Class<?>[] {Layer1ApiProvider.class}, new InvocationHandler() {
                    @Override
                    public Object invoke(Object proxy, Method m, Object[] args) {
                        if (m.getName().equals("sendUserMessage")) {
                            messages.add(args[0]);
                            return null;
                        }
                        return defaultValue(m.getReturnType());
                    }
                });
        this.api = (Api) Proxy.newProxyInstance(FakeBookmap.class.getClassLoader(), new Class<?>[] {Api.class},
                new InvocationHandler() {
                    @Override
                    public Object invoke(Object proxy, Method m, Object[] args) {
                        switch (m.getName()) {
                            case "registerIndicatorModifiable": {
                                String name = (String) args[0];
                                boolean line = args.length > 3 ? (Boolean) args[3] : true;
                                boolean widget = args.length > 4 ? (Boolean) args[4] : true;
                                if (indicators.containsKey(name)) {
                                    throw new IllegalStateException("indicator names must be unique: " + name);
                                }
                                FakeIndicator ind = new FakeIndicator(name, line, widget);
                                indicators.put(name, ind);
                                return ind;
                            }
                            case "registerIndicator":
                                throw new UnsupportedOperationException("the add-on only uses modifiable indicators");
                            case "getSettings":
                                return settings;
                            case "setSettings":
                                settings = args[0];
                                return null;
                            case "getProvider":
                                return provider;
                            case "sendUserMessage":
                                messages.add(args[0]);
                                return null;
                            case "sendOrder":
                            case "updateOrder":
                                throw new AssertionError("a levels add-on must never send orders");
                            default:
                                return defaultValue(m.getReturnType());
                        }
                    }
                });
    }

    public FakeIndicator indicator(String name) {
        FakeIndicator ind = indicators.get(name);
        if (ind == null) {
            throw new AssertionError("no indicator named " + name + "; have " + indicators.keySet());
        }
        return ind;
    }

    @SuppressWarnings("unchecked")
    public <T> List<T> messagesOf(Class<T> type) {
        List<T> out = new ArrayList<T>();
        synchronized (messages) {
            for (Object m : messages) {
                if (type.isInstance(m)) {
                    out.add((T) m);
                }
            }
        }
        return out;
    }

    static Object defaultValue(Class<?> type) {
        if (type == boolean.class) {
            return false;
        }
        if (type == int.class) {
            return 0;
        }
        if (type == long.class) {
            return 0L;
        }
        if (type == short.class) {
            return (short) 0;
        }
        if (type == byte.class) {
            return (byte) 0;
        }
        if (type == double.class) {
            return 0.0;
        }
        if (type == float.class) {
            return 0.0f;
        }
        if (type == char.class) {
            return (char) 0;
        }
        return null;
    }
}
