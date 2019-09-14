import React from 'react';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'isomorphic-unfetch';
import clientCredentials from '../credentials/client';
import Link from 'next/link';
import Head from '../components/head';

export default class Home extends React.Component {
  static async getInitialProps ({ req, query }) {
    const user = req && req.session ? req.session.decodedToken : null;
    // don't fetch anything from firebase if the user is not found
    // const snap = user && await req.firebaseServer.database().ref('items').once('value');
    // const items = snap && snap.val();
    const items = null;
    console.log('getInitialProps:user', user);
    return { user, items };
  }

  constructor (props) {
    super(props);

    this.state = {
      user: this.props.user,
      value: '',
      items: this.props.items,
    }

    this.addDbListener = this.addDbListener.bind(this);
    this.removeDbListener = this.removeDbListener.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
  }

  componentDidMount () {
    firebase.initializeApp(clientCredentials);

    if (this.state.user) this.addDbListener();

    firebase.auth().onAuthStateChanged(user => {
      console.log('componentDidMount:before:user', user);

      if (user) {
        this.setState({ user: user });

        console.log('after:user', user);
        console.log('user.uid', user.uid);

        return user
          .getIdToken()
          .then(token => {
            // eslint-disable-next-line no-undef
            return fetch('/api/login', {
              method: 'POST',
              // eslint-disable-next-line no-undef
              headers: new Headers({ 'Content-Type': 'application/json' }),
              credentials: 'same-origin',
              body: JSON.stringify({ token }),
            })
          })
          .then(res => this.addDbListener());
      } else {
        this.setState({ user: null });
        // eslint-disable-next-line no-undef
        fetch('/api/logout', {
          method: 'POST',
          credentials: 'same-origin'
        }).then(() => this.removeDbListener());
      }
    });
  }

  async addDbListener() {
    var db = firebase.firestore();

    const usersRef = db.collection('/users');
    const { user } = this.state;

    await usersRef.doc(user.uid).set({
      email: user.email || '',
      name: user.displayName || '',
      icon: user.photoURL || '',
      lastLoggedIn: Date.now(),
    });

    const itemsRef = await db
      .doc(`/users/${user.uid}`)
      .collection('items');

    const itemsSortedByCreatedAtRef = itemsRef.orderBy('createdAt', 'desc');

    let unsubscribe = itemsSortedByCreatedAtRef.onSnapshot(
        querySnapshot => {
          var items = new Map();

          querySnapshot.forEach(function (doc) {
            items.set(doc.id, doc);
          });

          if (items) this.setState({ items });
        },
        error => {
          console.error(error);
        }
      );

    this.setState({ unsubscribe });
  }

  removeDbListener () {
    // firebase.database().ref('items').off();
    if (this.state.unsubscribe) {
      this.state.unsubscribe();
    }
  }

  handleChange (event) {
    this.setState({ value: event.target.value });
  }

  handleSubmit(event) {
    event.preventDefault();

    var db = firebase.firestore();
    const usersRef = db.collection('/users');
    const { user } = this.state;
    const date = new Date().getTime();

    db.doc(`users/${user.uid}`)
      .collection('items')
      .doc(`${date}`)
      .set({
        id: date,
        text: this.state.value,
        createdAt: Date.now(),
      });

    this.setState({ value: '' });
  }

  handleLogin() {
    const google = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(google)
      .then((result) => { 
        console.log('result', result);
      }, () => {

      })
  }

  handleLogout() {
    firebase.auth().signOut();
  }

  handleDelete(doc) {
    if (!confirm('Are you OK?')) return;

    // Delete on firestore
    doc.ref.delete();

    // Delete on local state
    const items = Object.assign(new Map(), this.state.items);
    items.delete(doc.id);

    this.setState({ items });
  }

  render() {
    const { user, value, items } = this.state;

    return (
      <>
        <Head title="Home" />

        <nav className="uk-navbar-container uk-navbar" uk-navbar="true">
          <div className="uk-navbar-left">
            <ul className="uk-navbar-nav">
              <li className="uk-active">
                <Link prefetch href="/">
                  <a className="uk-navbar-item uk-logo">Shopper</a>
                </Link>
              </li>
            </ul>
          </div>

          <div className="uk-navbar-right">
            <ul className="uk-navbar-nav">
              <li className="uk-active">
                {user ?
                  (
                    <>
                      <a href="#" className="">Menu</a>
                      <div className="uk-navbar-dropdown uk-navbar-dropdown-bottom-right uk-animation-fade uk-animation-enter">
                        <ul className="uk-nav uk-navbar-dropdown-nav">
                          <li className="uk-active"><a href="#">Active</a></li>
                          <li><a href="#">Item</a></li>
                          <li><a href="#">Item</a></li>
                          <li><a onClick={this.handleLogout}>Logout</a></li>
                        </ul>
                      </div>
                    </>
                  ) :
                  (
                    <a onClick={this.handleLogin} className="">Login</a>
                  )
                }
              </li>
            </ul>
          </div>
        </nav>

        <div uk-spinner="true"></div>

        <div>
          <ul className="uk-flex-center uk-tab" uk-tab="">
            <li className="uk-active"><a href="#">Repeated</a></li>
            <li className=""><a href="#">Temporary</a></li>
          </ul>

          {user && (
            <>
              <form onSubmit={this.handleSubmit}>
                <div className="uk-margin">
                  <input
                    className="uk-input"
                    type={'text'}
                    onChange={this.handleChange}
                    placeholder={'add item...'}
                    value={value}
                  />
                </div>
              </form>
              <ul className="uk-list uk-list-divider uk-switcher">
                <li className="uk-active">
                  <ul className="uk-list uk-list-divider">
                    {items &&
                      Array.from(items.keys()).map(key => (
                        <li key={key}>
                          <label>{items.get(key).data().text}</label>
                          <a href="" className="uk-icon-button" uk-icon="trash" onClick={this.handleDelete.bind(null, items.get(key))}></a>
                        </li>
                      ))}
                  </ul>
                </li>
              </ul>
            </>
          )}
        </div>

        <style jsx>{`
        `}</style>
      </>
    );
  }
}
